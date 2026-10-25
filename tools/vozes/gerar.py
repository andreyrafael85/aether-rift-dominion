#!/usr/bin/env python3
"""5.0a.2: gera as 12 falas representativas (tools/vozes/falas.json) com cada voz neural candidata (Kokoro-82M e Piper pt_BR), mede o tempo
de carga e de síntese, apara o silêncio das pontas, nivela o volume (nível ativo -20 dBFS, pico -1 dBFS), grava OGG/Opus 32 kbps e MP3 48 kbps
em work/vozes/<voz>/, mede o tom médio (F0) e confere cada fala por transcrição (Whisper small, CPU) para achar palavra engolida ou trocada.
Tudo roda na máquina de build, com modelos e caches em .tools/vozes/ (ignorada pelo git). Nada disso vai para o jogo além dos áudios.
Uso: .tools/vozes/venv/bin/python tools/vozes/gerar.py [--sem-whisper] [--so id1,id2]"""
import os, sys, json, time, re, subprocess, unicodedata, platform
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
T = os.path.join(ROOT, '.tools', 'vozes')
for k, v in {'HF_HOME': 'cache/hf', 'XDG_CACHE_HOME': 'cache/xdg', 'TORCH_HOME': 'cache/torch', 'TMPDIR': 'tmp'}.items():
    os.environ.setdefault(k, os.path.join(T, v))
THREADS = 2  # máquina dividida com outros agentes: com carga alta, menos threads disputam menos
for k in ('OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'OPENBLAS_NUM_THREADS'): os.environ.setdefault(k, str(THREADS))
import numpy as np, soundfile as sf, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
MOD, OUT, TMP = os.path.join(T, 'modelos'), os.path.join(ROOT, 'work', 'vozes'), os.path.join(T, 'tmp', 'wav')
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
CFG = json.load(open(os.path.join(ROOT, 'tools', 'vozes', 'falas.json'), encoding='utf-8')); FALAS = CFG['falas']
ARGS = sys.argv[1:]; SO = None
if '--so' in ARGS: SO = set(ARGS[ARGS.index('--so') + 1].split(','))

LIC_KOKORO = {'resumo': 'Apache-2.0 (pesos)', 'uso_comercial': 'sim',
              'detalhe': 'Pesos Apache-2.0 (hexgrad/Kokoro-82M, model card). Treino declarado só com áudio permissivo ou sem direitos autorais; entre os dados CC BY, Koniwa (CC BY 3.0) e SIWIS (CC BY 4.0), creditados no ASSETS.md. G2P misaki (Apache-2.0) com espeak-ng (GPL-3.0) só na máquina de build.'}
LIC_PIPER = {'resumo': 'dados CC0, base lessac só para pesquisa', 'uso_comercial': 'risco',
             'detalhe': 'MODEL_CARD: dados pt_BR CC0 (OHF-Voice/voice-datasets), mas "Finetuned from U.S. English lessac voice". O MODEL_CARD da lessac aponta a licença do Blizzard 2013 Lessac: "Research Purposes only", sem uso comercial nem produto de síntese de voz. Repositório rhasspy/piper-voices marcado MIT. Programa piper-tts 1.8 (GPL-3.0) só na máquina de build.'}
CANDIDATAS = [
    dict(id='kokoro-pf_dora', modelo='Kokoro-82M v1.0', motor='kokoro', voz='pf_dora', licenca=LIC_KOKORO),
    dict(id='kokoro-pm_alex', modelo='Kokoro-82M v1.0', motor='kokoro', voz='pm_alex', licenca=LIC_KOKORO),
    dict(id='kokoro-pm_santa', modelo='Kokoro-82M v1.0', motor='kokoro', voz='pm_santa', licenca=LIC_KOKORO),
    dict(id='piper-faber', modelo='Piper medium (VITS)', motor='piper', voz='pt_BR-faber-medium', licenca=LIC_PIPER),
    dict(id='piper-cadu', modelo='Piper medium (VITS)', motor='piper', voz='pt_BR-cadu-medium', licenca=LIC_PIPER),
    dict(id='piper-jeff', modelo='Piper medium (VITS)', motor='piper', voz='pt_BR-jeff-medium', licenca=LIC_PIPER),
]
DESCARTADAS = [
    dict(modelo='Piper pt_BR-edresson-low', motivo='afinada a partir da en_US ryan (dados CC BY-NC-SA 4.0, não comercial); e é a qualidade low (16 kHz)'),
    dict(modelo='XTTS-v2 (Coqui)', motivo='Coqui Public Model License: não comercial'),
    dict(modelo='F5-TTS', motivo='pesos CC BY-NC 4.0 (dados Emilia): não comercial'),
    dict(modelo='MMS-TTS por (Meta)', motivo='CC BY-NC 4.0: não comercial'),
    dict(modelo='Fish Speech / OpenAudio S1-mini', motivo='CC BY-NC-SA 4.0: não comercial'),
    dict(modelo='Spark-TTS', motivo='CC BY-NC-SA 4.0: não comercial'),
]

def ff(*a):
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', *a], check=True)

def aparar(x, sr, lim_db=-42.0, antes=0.05, depois=0.12):
    """corta o silêncio das pontas (janelas de 10 ms abaixo de lim_db do pico), com folga e rampa de 5 ms"""
    n = max(1, int(sr * 0.01)); m = len(x) // n
    if m < 3: return x
    rms = np.sqrt((x[:m * n].reshape(m, n) ** 2).mean(1) + 1e-12); db = 20 * np.log10(rms / (rms.max() + 1e-12))
    on = np.where(db > lim_db)[0]
    if not len(on): return x
    a = max(0, on[0] * n - int(antes * sr)); b = min(len(x), (on[-1] + 1) * n + int(depois * sr)); y = x[a:b].astype(np.float32).copy()
    r = int(sr * 0.005)
    if len(y) > 2 * r: w = np.linspace(0, 1, r, dtype=np.float32); y[:r] *= w; y[-r:] *= w[::-1]
    return y

def nivelar(x, sr, alvo=-20.0, pico=-1.0):
    """nível ativo (janelas de 20 ms a menos de 30 dB do pico) em alvo dBFS, sem passar de pico dBFS"""
    n = int(sr * 0.02); m = max(1, len(x) // n); fr = x[:m * n].reshape(m, n) if len(x) >= n else x.reshape(1, -1)
    rms = np.sqrt((fr ** 2).mean(1) + 1e-12); at = rms[rms > rms.max() * 10 ** (-30 / 20)]
    nv = 20 * np.log10(np.sqrt((at ** 2).mean()) + 1e-12); g = 10 ** ((alvo - nv) / 20); pk = float(np.abs(x).max()) * g
    if pk > 10 ** (pico / 20): g *= 10 ** (pico / 20) / pk
    y = (x * g).astype(np.float32); return y, 20 * np.log10(float(np.abs(y).max()) + 1e-12)

def f0_mediana(x, sr):
    """tom médio por autocorrelação em janelas de 40 ms (70 a 400 Hz), só nos trechos com voz"""
    n = int(sr * 0.04); h = n // 2; lo, hi = int(sr / 400), int(sr / 70); vals = []; ref = float(np.abs(x).max()) + 1e-9
    for i in range(0, len(x) - n, h):
        f = x[i:i + n] - x[i:i + n].mean()
        if np.sqrt((f ** 2).mean()) < ref * 0.08: continue
        ac = np.correlate(f, f, 'full')[n - 1:]; ac = ac / (ac[0] + 1e-12); k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.55: vals.append(sr / k)
    return round(float(np.median(vals)), 1) if vals else None

def norm(s):
    s = unicodedata.normalize('NFKD', s.lower()); s = ''.join(c for c in s if not unicodedata.combining(c))
    return ' '.join(re.sub(r'[^a-z0-9 ]+', ' ', s).split())

def lev(a, b):
    p = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        c = [i]
        for j, cb in enumerate(b, 1): c.append(min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (ca != cb)))
        p = c
    return p[-1]

def sintetizador(c):
    """carrega o modelo e devolve (falar(texto) -> (áudio float32, sr), segundos de carga, MB do modelo)"""
    t0 = time.time()
    if c['motor'] == 'kokoro':
        import torch; torch.set_num_threads(THREADS)
        try: torch.set_num_interop_threads(1)
        except RuntimeError: pass
        from kokoro import KModel, KPipeline
        d = os.path.join(MOD, 'kokoro'); model = KModel(repo_id='hexgrad/Kokoro-82M', config=os.path.join(d, 'config.json'), model=os.path.join(d, 'kokoro-v1_0.pth')).eval()
        pipe = KPipeline(lang_code='p', repo_id='hexgrad/Kokoro-82M', model=model); vp = os.path.join(d, 'voices', c['voz'] + '.pt')
        def falar(txt):
            with torch.no_grad(): parts = [r.audio.numpy() for r in pipe(txt, voice=vp, speed=1.0) if r.audio is not None]
            return np.concatenate(parts).astype(np.float32), 24000
        mb = (os.path.getsize(os.path.join(d, 'kokoro-v1_0.pth')) + os.path.getsize(vp)) / 1e6
    else:
        import onnxruntime as ort
        if not getattr(ort, '_ard_threads', False):  # o piper cria a sessão com as opções padrão (todas as threads): limita aqui
            _SO = ort.SessionOptions
            def _so(*a, **k):
                o = _SO(*a, **k); o.intra_op_num_threads = THREADS; o.inter_op_num_threads = 1; return o
            ort.SessionOptions = _so; ort._ard_threads = True
        from piper import PiperVoice, SynthesisConfig
        d = os.path.join(MOD, 'piper', c['voz']); onnx = os.path.join(d, c['voz'] + '.onnx'); voice = PiperVoice.load(onnx, config_path=onnx + '.json'); cfg = SynthesisConfig()
        def falar(txt):
            ch = list(voice.synthesize(txt, syn_config=cfg)); return np.concatenate([x.audio_float_array for x in ch]).astype(np.float32), ch[0].sample_rate
        mb = os.path.getsize(onnx) / 1e6
    falar('Teste de aquecimento.')  # primeira chamada inicia o G2P e a sessão: conta como carga
    return falar, time.time() - t0, mb

def main():
    whisper = None
    if '--sem-whisper' not in ARGS:
        from faster_whisper import WhisperModel
        whisper = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=THREADS, num_workers=1, download_root=os.path.join(MOD, 'whisper'))
    man_path = os.path.join(OUT, 'manifesto.json'); antigo = json.load(open(man_path, encoding='utf-8')) if os.path.exists(man_path) else {}
    feitas = {x['id']: x for x in antigo.get('candidatas', [])}; res = []
    for c in CANDIDATAS:
        if SO and c['id'] not in SO:
            if c['id'] in feitas: res.append(feitas[c['id']])
            continue
        falar, carga, mb = sintetizador(c); od = os.path.join(OUT, c['id']); os.makedirs(od, exist_ok=True); itens = []; f0s = []
        carga_ini = os.getloadavg()[0]
        for f in FALAS:
            t, tc = time.time(), time.process_time(); x, sr = falar(f['texto']); dt, dc = time.time() - t, time.process_time() - tc
            dur_bruta = len(x) / sr; y = aparar(x, sr); y, pk = nivelar(y, sr); f0 = f0_mediana(y, sr)
            if f0: f0s.append(f0)
            wav = os.path.join(TMP, c['id'] + '-' + f['id'] + '.wav'); sf.write(wav, y, sr, subtype='PCM_16')
            ogg, mp3, o24 = os.path.join(od, f['id'] + '.ogg'), os.path.join(od, f['id'] + '.mp3'), os.path.join(TMP, c['id'] + '-' + f['id'] + '-24k.ogg')
            ff('-i', wav, '-map_metadata', '-1', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'audio', ogg)
            ff('-i', wav, '-map_metadata', '-1', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '24k', '-vbr', 'on', '-application', 'audio', o24)
            ff('-i', wav, '-map_metadata', '-1', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', mp3)
            it = dict(id=f['id'], dur_s=round(len(y) / sr, 3), dur_bruta_s=round(dur_bruta, 3), sintese_s=round(dt, 3), cpu_s=round(dc, 3), sr=sr, pico_db=round(pk, 1), f0_hz=f0,
                      opus32_b=os.path.getsize(ogg), opus24_b=os.path.getsize(o24), mp3_b=os.path.getsize(mp3))
            if whisper:
                segs, _ = whisper.transcribe(wav, language='pt', beam_size=5, initial_prompt=CFG['vocabulario'] + '.', condition_on_previous_text=False, vad_filter=False)
                hyp = ' '.join(s.text.strip() for s in segs).strip(); r, h = norm(f['texto']), norm(hyp)
                it.update(asr=hyp, cer=round(lev(r, h) / max(1, len(r)), 3), wer=round(lev(r.split(), h.split()) / max(1, len(r.split())), 3))
            itens.append(it); print(f"{c['id']:18} {f['id']:26} {it['dur_s']:5.2f} s  síntese {dt:5.2f} s  F0 {f0}  opus {it['opus32_b']:6d} B" + (f"  CER {it['cer']:.2f}  «{it['asr']}»" if whisper else ''), flush=True)
        aud = sum(i['dur_s'] for i in itens); sin = sum(i['sintese_s'] for i in itens); cpu = sum(i['cpu_s'] for i in itens)
        reg = dict(c, modelo_mb=round(mb, 1), carga_s=round(carga, 2), sintese_s=round(sin, 2), cpu_s=round(cpu, 2), audio_s=round(aud, 2), rtf=round(sin / aud, 3), rtf_cpu=round(cpu / aud, 3), carga_maquina=[round(carga_ini, 1), round(os.getloadavg()[0], 1)], f0_hz=round(float(np.median(f0s)), 1) if f0s else None,
                   opus32_kb=round(sum(i['opus32_b'] for i in itens) / 1024, 1), opus24_kb=round(sum(i['opus24_b'] for i in itens) / 1024, 1), mp3_kb=round(sum(i['mp3_b'] for i in itens) / 1024, 1),
                   opus32_kbps_medio=round(sum(i['opus32_b'] for i in itens) * 8 / 1000 / aud, 1), falas=itens)
        if whisper: reg.update(cer=round(float(np.mean([i['cer'] for i in itens])), 3), wer=round(float(np.mean([i['wer'] for i in itens])), 3), falas_exatas=sum(1 for i in itens if i['cer'] == 0))
        res.append(reg); print(f"== {c['id']}: carga {carga:.1f} s · síntese {sin:.1f} s (CPU {cpu:.1f} s) para {aud:.1f} s de áudio (RTF {sin / aud:.2f}, CPU {cpu / aud:.2f}) · carga da máquina {reg['carga_maquina']} · Opus 32k {reg['opus32_kb']} KB · F0 {reg['f0_hz']} Hz" + (f" · CER {reg['cer']:.3f}" if whisper else ''), flush=True)
    import torch, kokoro
    man = dict(gerado=time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()), maquina=f"{os.cpu_count()} vCPU ({platform.processor() or platform.machine()}), sem GPU, {THREADS} threads", python=platform.python_version(),
               pacotes=dict(kokoro=getattr(kokoro, '__version__', '0.9.4'), torch=torch.__version__), falas=FALAS, vocabulario=CFG['vocabulario'], candidatas=res, descartadas=DESCARTADAS,
               conferencia='Whisper small (faster-whisper, int8, CPU), português, com o vocabulário do jogo como contexto; CER = erro por caractere, sem acentos e pontuação' if whisper else None)
    json.dump(man, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('manifesto:', man_path)

if __name__ == '__main__':
    main()
