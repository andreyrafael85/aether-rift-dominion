#!/usr/bin/env python3
"""5.0a.2: gera as falas das vozes neurais na máquina de build (modelos e caches em .tools/vozes/, ignorada pelo git; nada disso vai para o jogo
além dos áudios). Etapas (--etapa):
  mesa    as 12 falas representativas (tools/vozes/falas.json) em cada voz candidata (Kokoro-82M e Piper pt_BR): mede carga e síntese, apara o
          silêncio das pontas, nivela (nível ativo -20 dBFS, pico -1 dBFS), grava OGG/Opus 32 kbps e MP3 48 kbps em work/vozes/<voz>/, mede o
          tom médio e confere cada fala por transcrição (Whisper small, CPU). --falas id1,id2 refaz só essas falas e junta ao manifesto.
  racas   2ª rodada: o caráter de cada Raça assado nos arquivos (tools/vozes/racas.py) para as falas da faixa das Raças nas três vozes do
          Kokoro: work/vozes/racas/<raça>/<voz>/<fala>.ogg|mp3, com as medidas (piso nas pausas, HNR, aspereza, nível, pico) e a transcrição.
  elenco  a saudação da Sala de cada líder e dois avisos do locutor de cada Raça, na voz do elenco proposto (misturas do Kokoro com pesos)
          e com o caráter da Raça: work/vozes/elenco/<raça>-lider.ogg|mp3 e <raça>-locutor-<fala>.ogg|mp3.
  antes   mede as cadeias ao vivo da página v1 (renderizadas por tools/vozes/racas-antes.cjs em .tools/vozes/tmp/antes/) e grava o antes do
          Vehnar e do Vorag em work/vozes/racas-antes/<raça>/<fala>.ogg|mp3, para ouvir lado a lado.
  jogo       5.0c.1: as falas do jogo (tools/vozes/roteiro.json) num idioma, no elenco e com o caráter da Raça assado: mestres sem perda em
             .tools/vozes/mestres/, Opus 24 kbps em assets/vozes/<idioma>/<pacote>/<id>.ogg, conferência pelo Whisper e tempos de cada palavra
             (tools/vozes/jogo.py). Retomável: pula o que já existe. --idioma pt-BR|en|es, --so <tipo|raça|pacote|id,...>, --refazer.
  manifesto  5.0c.1: assets/vozes/<idioma>/manifesto.json a partir do que a etapa jogo gravou (--idioma; sem ele, os três).
  formato    5.0c.1: --formato m4a|mp3 grava a mesma árvore no outro formato a partir dos mestres e acrescenta o formato no manifesto.
  reconferir 5.0c.1: recalcula o erro de cada fala pelo texto que o Whisper já ouviu (equivalências de grafia em jogo.EQUIV), sem gerar de novo.
Uso: .tools/vozes/venv/bin/python tools/vozes/gerar.py [--etapa mesa|racas|elenco|antes|jogo|manifesto|formato|reconferir] [--falas id1,id2] [--so voz1,voz2] [--racas r1,r2] [--sem-whisper] [--threads N]"""
import os, sys, json, time, re, subprocess, unicodedata, platform
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
T = os.path.join(ROOT, '.tools', 'vozes')
for k, v in {'HF_HOME': 'cache/hf', 'XDG_CACHE_HOME': 'cache/xdg', 'TORCH_HOME': 'cache/torch', 'TMPDIR': 'tmp'}.items():
    os.environ.setdefault(k, os.path.join(T, v))
THREADS = int(os.environ.get('ARD_THREADS') or (sys.argv[sys.argv.index('--threads') + 1] if '--threads' in sys.argv else 2))  # 5.0c.1: --threads N (a etapa jogo usa 1)
for k in ('OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'OPENBLAS_NUM_THREADS'): os.environ.setdefault(k, str(THREADS))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf, imageio_ffmpeg
import racas as RC
FF = imageio_ffmpeg.get_ffmpeg_exe()
MOD, OUT, TMP = os.path.join(T, 'modelos'), os.path.join(ROOT, 'work', 'vozes'), os.path.join(T, 'tmp', 'wav')
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
CFG = json.load(open(os.path.join(ROOT, 'tools', 'vozes', 'falas.json'), encoding='utf-8')); FALAS = CFG['falas']
ARGS = sys.argv[1:]
def arg(nome, padrao=None): return ARGS[ARGS.index(nome) + 1] if nome in ARGS else padrao
SO = set(arg('--so').split(',')) if arg('--so') else None
FALAS_SO = set(arg('--falas').split(',')) if arg('--falas') else None
ETAPA = arg('--etapa', 'mesa')
RACAS_SO = arg('--racas').split(',') if arg('--racas') else None  # refaz só estas Raças nas etapas racas e elenco (junta ao manifesto)

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
    """nível ativo (janelas de 20 ms a menos de 30 dB do pico, na mistura mono) em alvo dBFS, sem passar de pico dBFS (mono ou estéreo)"""
    x = np.asarray(x, np.float64); m = x.mean(1) if x.ndim == 2 else x
    n = int(sr * 0.02); k = max(1, len(m) // n); fr = m[:k * n].reshape(k, n) if len(m) >= n else m.reshape(1, -1)
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

def kokoro():
    """carrega o Kokoro uma vez e devolve falar(texto, pesos, velocidade) -> (áudio float32, 24000), com mistura de vozes por pesos"""
    import torch; torch.set_num_threads(THREADS)
    try: torch.set_num_interop_threads(1)
    except RuntimeError: pass
    from kokoro import KModel, KPipeline
    d = os.path.join(MOD, 'kokoro'); model = KModel(repo_id='hexgrad/Kokoro-82M', config=os.path.join(d, 'config.json'), model=os.path.join(d, 'kokoro-v1_0.pth')).eval()
    pipe = KPipeline(lang_code='p', repo_id='hexgrad/Kokoro-82M', model=model); cache = {}
    def pacote(pesos):
        k = tuple(sorted(pesos.items()))
        if k not in cache: cache[k] = sum(w * pipe.load_single_voice(os.path.join(d, 'voices', v + '.pt')) for v, w in pesos.items())
        return cache[k]
    def falar(txt, pesos, vel=1.0):
        with torch.no_grad(): parts = [r.audio.numpy() for r in pipe(txt, voice=pacote(pesos), speed=vel) if r.audio is not None]
        return np.concatenate(parts).astype(np.float32), 24000
    falar('Teste de aquecimento.', {'pm_alex': 1.0})
    return falar, d

def sintetizador(c):
    """carrega o modelo e devolve (falar(texto) -> (áudio float32, sr), segundos de carga, MB do modelo)"""
    t0 = time.time()
    if c['motor'] == 'kokoro':
        k, d = kokoro(); vp = os.path.join(d, 'voices', c['voz'] + '.pt')
        falar = lambda txt: k(txt, {c['voz']: 1.0})
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

_WHISPER = None
def whisper():
    global _WHISPER
    if _WHISPER is None and '--sem-whisper' not in ARGS:
        from faster_whisper import WhisperModel
        _WHISPER = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=THREADS, num_workers=1, download_root=os.path.join(MOD, 'whisper'))
    return _WHISPER

def transcrever(wav, texto):
    w = whisper()
    if not w: return {}
    segs, _ = w.transcribe(wav, language='pt', beam_size=5, initial_prompt=CFG['vocabulario'] + '.', condition_on_previous_text=False, vad_filter=False)
    hyp = ' '.join(s.text.strip() for s in segs).strip(); r, h = norm(texto), norm(hyp)
    return dict(asr=hyp, cer=round(lev(r, h) / max(1, len(r)), 3), wer=round(lev(r.split(), h.split()) / max(1, len(r.split())), 3))

def codificar(wav, base, estereo=False):
    """OGG/Opus (mono 32 kbps; estéreo 48 kbps) e MP3 (48 ou 64 kbps) ao lado; devolve os tamanhos"""
    ac = '2' if estereo else '1'
    ff('-i', wav, '-map_metadata', '-1', '-ac', ac, '-ar', '48000', '-c:a', 'libopus', '-b:a', '48k' if estereo else '32k', '-vbr', 'on', '-application', 'audio', base + '.ogg')
    ff('-i', wav, '-map_metadata', '-1', '-ac', ac, '-c:a', 'libmp3lame', '-b:a', '64k' if estereo else '48k', base + '.mp3')
    return os.path.getsize(base + '.ogg'), os.path.getsize(base + '.mp3')

def decodificar(arq):
    """o que o jogador ouve: decodifica o arquivo final a 48 kHz"""
    tmp = os.path.join(T, 'tmp', 'dec.wav'); ff('-i', arq, '-ar', '48000', tmp); y, sr = sf.read(tmp, dtype='float64'); return y, sr

def manifesto():
    p = os.path.join(OUT, 'manifesto.json'); return (json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}), p

def gravar_manifesto(man, p):
    json.dump(man, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('manifesto:', p, flush=True)

# ---------- etapa mesa ----------
def etapa_mesa():
    antigo, man_path = manifesto(); feitas = {x['id']: x for x in antigo.get('candidatas', [])}; res = []; ids = [f['id'] for f in FALAS]
    for c in CANDIDATAS:
        if SO and c['id'] not in SO:
            if c['id'] in feitas: res.append(feitas[c['id']])
            continue
        alvo = [f for f in FALAS if not FALAS_SO or f['id'] in FALAS_SO]
        falar, carga, mb = sintetizador(c); od = os.path.join(OUT, c['id']); os.makedirs(od, exist_ok=True); novos = {}; carga_ini = os.getloadavg()[0]
        for f in alvo:
            t, tc = time.time(), time.process_time(); x, sr = falar(f['texto']); dt, dc = time.time() - t, time.process_time() - tc
            dur_bruta = len(x) / sr; y = aparar(x, sr); y, pk = nivelar(y, sr); f0 = f0_mediana(y, sr)
            wav = os.path.join(TMP, c['id'] + '-' + f['id'] + '.wav'); sf.write(wav, y, sr, subtype='PCM_16')
            ogg, mp3, o24 = os.path.join(od, f['id'] + '.ogg'), os.path.join(od, f['id'] + '.mp3'), os.path.join(TMP, c['id'] + '-' + f['id'] + '-24k.ogg')
            ff('-i', wav, '-map_metadata', '-1', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'audio', ogg)
            ff('-i', wav, '-map_metadata', '-1', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '24k', '-vbr', 'on', '-application', 'audio', o24)
            ff('-i', wav, '-map_metadata', '-1', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', mp3)
            it = dict(id=f['id'], dur_s=round(len(y) / sr, 3), dur_bruta_s=round(dur_bruta, 3), sintese_s=round(dt, 3), cpu_s=round(dc, 3), sr=sr, pico_db=round(pk, 1), f0_hz=f0,
                      opus32_b=os.path.getsize(ogg), opus24_b=os.path.getsize(o24), mp3_b=os.path.getsize(mp3), gerada=time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()))
            it.update(transcrever(wav, f['texto'])); novos[f['id']] = it
            print(f"{c['id']:18} {f['id']:26} {it['dur_s']:5.2f} s  síntese {dt:5.2f} s  F0 {f0}  opus {it['opus32_b']:6d} B" + (f"  CER {it['cer']:.2f}  «{it['asr']}»" if 'cer' in it else ''), flush=True)
        velhos = {i['id']: i for i in feitas.get(c['id'], {}).get('falas', [])}; itens = [novos.get(i) or velhos.get(i) for i in ids]
        if any(i is None for i in itens): raise SystemExit(f"{c['id']}: faltam falas no manifesto; rode sem --falas")
        for i in velhos:  # fala renomeada (Sylva → Sylvia): apaga os arquivos antigos
            if i not in ids:
                for ext in ('.ogg', '.mp3'):
                    p = os.path.join(od, i + ext)
                    if os.path.exists(p): os.remove(p)
        aud = sum(i['dur_s'] for i in itens); sin = sum(i['sintese_s'] for i in itens); cpu = sum(i['cpu_s'] for i in itens); f0s = [i['f0_hz'] for i in itens if i.get('f0_hz')]
        base = dict(feitas.get(c['id'], {})) if FALAS_SO else {}
        reg = dict(c, modelo_mb=round(mb, 1), carga_s=base.get('carga_s', round(carga, 2)), sintese_s=round(sin, 2), cpu_s=round(cpu, 2), audio_s=round(aud, 2), rtf=round(sin / aud, 3), rtf_cpu=round(cpu / aud, 3),
                   carga_maquina=base.get('carga_maquina', [round(carga_ini, 1), round(os.getloadavg()[0], 1)]), f0_hz=round(float(np.median(f0s)), 1) if f0s else None,
                   opus32_kb=round(sum(i['opus32_b'] for i in itens) / 1024, 1), opus24_kb=round(sum(i['opus24_b'] for i in itens) / 1024, 1), mp3_kb=round(sum(i['mp3_b'] for i in itens) / 1024, 1),
                   opus32_kbps_medio=round(sum(i['opus32_b'] for i in itens) * 8 / 1000 / aud, 1), falas=itens)
        if all('cer' in i for i in itens): reg.update(cer=round(float(np.mean([i['cer'] for i in itens])), 3), wer=round(float(np.mean([i['wer'] for i in itens])), 3), falas_exatas=sum(1 for i in itens if i['cer'] == 0))
        if FALAS_SO: reg['refeitas'] = sorted(FALAS_SO)
        res.append(reg); print(f"== {c['id']}: {len(novos)} falas novas · Opus 32k {reg['opus32_kb']} KB · F0 {reg['f0_hz']} Hz" + (f" · CER {reg['cer']:.3f}" if 'cer' in reg else ''), flush=True)
    import torch, kokoro as K
    man = dict(antigo, gerado=time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()), maquina=f"{os.cpu_count()} vCPU ({platform.processor() or platform.machine()}), sem GPU, {THREADS} threads", python=platform.python_version(),
               pacotes=dict(kokoro=getattr(K, '__version__', '0.9.4'), torch=torch.__version__), falas=FALAS, vocabulario=CFG['vocabulario'], candidatas=res, descartadas=DESCARTADAS,
               conferencia='Whisper small (faster-whisper, int8, CPU), português, com o vocabulário do jogo como contexto; CER = erro por caractere, sem acentos e pontuação')
    gravar_manifesto(man, man_path)

# ---------- etapa racas: o caráter de cada Raça assado ----------
def assar_e_medir(raca, x, sr, base, texto, regiao_seco, pausas=None):
    """assa a Raça, nivela, grava WAV, codifica, decodifica o OGG final e mede/transcreve o que o jogador vai ouvir"""
    y, pre = RC.assar(raca, x, sr); y, _ = nivelar(y, RC.SR); est = raca in RC.ESTEREO
    os.makedirs(os.path.dirname(base), exist_ok=True); wav = os.path.join(T, 'tmp', 'assada.wav'); sf.write(wav, y, RC.SR, subtype='PCM_16')
    ob, mb = codificar(wav, base, est); d, dsr = decodificar(base + '.ogg'); dw = os.path.join(T, 'tmp', 'assada-dec.wav'); sf.write(dw, d, dsr, subtype='PCM_16')
    med = RC.medir(d, dsr, (regiao_seco[0] + pre, regiao_seco[1] + pre), pausas, pre); med.update(transcrever(dw, texto)); med.update(ogg_b=ob, mp3_b=mb, inicio_s=pre, estereo=est)
    return med

def etapa_racas():
    man, p = manifesto(); txt = {f['id']: f['texto'] for f in FALAS}; alvo = RACAS_SO or RC.RACAS
    R = man['racas'] if RACAS_SO and man.get('racas') else dict(linhas=RC.LINHAS_RACA, vozes=RC.VOZES_RACA, seco={}, itens={r: {} for r in RC.RACAS})
    R['gerado'] = time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())
    for v in RC.VOZES_RACA:
        cid = 'kokoro-' + v; R['seco'][v] = {}
        for r in alvo: R['itens'].setdefault(r, {})[v] = {}
        for L in RC.LINHAS_RACA:
            x, sr = sf.read(os.path.join(TMP, cid + '-' + L + '.wav'), dtype='float64')
            d, dsr = decodificar(os.path.join(OUT, cid, L + '.ogg')); reg = RC.regiao_fala(d, dsr); pz = RC.pausas_da_seca(d, dsr, reg); seco = RC.medir(d, dsr, reg, pz)
            dw = os.path.join(T, 'tmp', 'seco-dec.wav'); sf.write(dw, d, dsr, subtype='PCM_16'); seco.update(transcrever(dw, txt[L])); seco['regiao'] = [round(reg[0], 3), round(reg[1], 3)]; R['seco'][v][L] = seco
            for r in alvo:
                t = time.time(); med = assar_e_medir(r, x, sr, os.path.join(OUT, 'racas', r, cid, L), txt[L], reg, pz); med['assar_s'] = round(time.time() - t, 2); R['itens'][r][v][L] = med
                print(f"{r:8} {v:9} {L:24} piso {med['piso_rel_db']:6.1f} (seco {seco['piso_rel_db']:6.1f}) · pausas {med.get('piso_pausas_rel_db')} (seco {seco.get('piso_pausas_rel_db')}) · HNR {med['hnr_db']} (seco {seco['hnr_db']}) · aspereza {med['aspereza_db']} (seco {seco['aspereza_db']}) · F0 {med['f0_hz']} · nível {med['nivel_db']} pico {med['pico_db']} · CER {med.get('cer')} «{med.get('asr')}»", flush=True)
    man['racas'] = R; gravar_manifesto(man, p)

# ---------- etapa elenco ----------
def falas_da_sala():
    s = open(os.path.join(ROOT, 'src', 'm5', 'sala-mundo.js'), encoding='utf-8').read(); out = {}
    for r in RC.RACAS:
        m = re.search(r"\b" + r + r":\s*\{.*?fala:\s*'([^']+)'", s, re.S); out[r] = m.group(1).replace('Sylva Oriel', 'Sylvia Oriel') if m else None
    return out

def etapa_elenco():
    man, p = manifesto(); falar, _ = kokoro(); sala = falas_da_sala(); E = man['elenco'] if RACAS_SO and man.get('elenco') else dict(racas={})
    E['gerado'] = time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())
    def uma(texto, pesos, vel, raca, base):
        t, tc = time.time(), time.process_time(); x, sr = falar(texto, pesos, vel); dt = time.time() - t
        x = aparar(x, sr); x, _ = nivelar(x, sr); seco_wav = os.path.join(T, 'tmp', 'elenco-seco.wav'); sf.write(seco_wav, x, sr, subtype='PCM_16')
        s48 = RC.para48(x, sr); reg = RC.regiao_fala(s48, RC.SR); med = assar_e_medir(raca, x, sr, base, texto, reg, RC.pausas_da_seca(s48, RC.SR, reg))
        med.update(texto=texto, f0_seco_hz=f0_mediana(x, sr), sintese_s=round(dt, 2), dur_seco_s=round(len(x) / sr, 2), seco=transcrever(seco_wav, texto))
        print(f"{raca:8} {os.path.basename(base):22} F0 seco {med['f0_seco_hz']} · F0 {med['f0_hz']} · CER {med.get('cer')} «{med.get('asr')}» · seco CER {med['seco'].get('cer')}", flush=True)
        return med
    for r in (RACAS_SO or RC.RACAS):
        c = RC.ELENCO.get(r) or RC.ELENCO[r.split('-')[0]]; od = os.path.join(OUT, 'elenco')  # 3ª rodada: vorag-a/b/c usam o elenco do Vorag
        E['racas'][r] = dict(c, lider_fala=uma(sala[r.split('-')[0]], c['lider_pesos'], c['lider_vel'], r, os.path.join(od, r + '-lider')),
                             locutor_falas=[dict(id=L, **uma(texto, c['locutor_pesos'], c['locutor_vel'], r, os.path.join(od, r + '-locutor-' + L))) for L, texto in RC.LOCUTOR_FALAS])
    man['elenco'] = E; gravar_manifesto(man, p)

# ---------- etapa antes: as cadeias ao vivo da v1 ----------
def etapa_antes():
    man, p = manifesto(); txt = {f['id']: f['texto'] for f in FALAS}; base = os.path.join(T, 'tmp', 'antes'); A = dict(voz='pm_alex', linhas=RC.LINHAS_RACA, itens={}, origem='work/antes/vozes-escolha-v1.html (montar), renderizada por tools/vozes/racas-antes.cjs')
    pre = {'vehnar': 0.14}
    for r in ['seco'] + RC.RACAS:
        A['itens'][r] = {}
        for L in RC.LINHAS_RACA:
            y, sr = sf.read(os.path.join(base, r, L + '.wav'), dtype='float64')
            s, _ = sf.read(os.path.join(base, 'seco', L + '.wav'), dtype='float64'); sm = s.mean(1) if s.ndim == 2 else s; reg = RC.regiao_fala(sm, sr)
            med = RC.medir(y, sr, (reg[0] + pre.get(r, 0.0), reg[1] + pre.get(r, 0.0)), RC.pausas_da_seca(sm, sr, reg), pre.get(r, 0.0))
            wv = os.path.join(T, 'tmp', 'antes-mono.wav'); sf.write(wv, (y.mean(1) if y.ndim == 2 else y), sr, subtype='PCM_16'); med.update(transcrever(wv, txt[L]))
            if r in ('vehnar', 'vorag'):  # o antes destes dois vai para a página, para ouvir lado a lado (o conteúdo é mono)
                os.makedirs(os.path.join(OUT, 'racas-antes', r), exist_ok=True); ob, mb = codificar(wv, os.path.join(OUT, 'racas-antes', r, L), False); med.update(ogg_b=ob, mp3_b=mb)
            A['itens'][r][L] = med
            print(f"antes {r:8} {L:24} piso {med['piso_rel_db']:6.1f} · pausas {med.get('piso_pausas_rel_db')} · HNR {med['hnr_db']} · aspereza {med['aspereza_db']} · F0 {med['f0_hz']} · nível {med['nivel_db']} pico {med['pico_db']} · CER {med.get('cer')} «{med.get('asr')}»", flush=True)
    man['racas_antes'] = A; gravar_manifesto(man, p)

if __name__ == '__main__':
    if ETAPA in ('jogo', 'manifesto', 'formato', 'reconferir'):  # 5.0c.1: as falas do jogo (tools/vozes/jogo.py)
        import jogo; jogo.main(sys.modules[__name__], ETAPA)
    else:
        {'mesa': etapa_mesa, 'racas': etapa_racas, 'elenco': etapa_elenco, 'antes': etapa_antes}[ETAPA]()
