#!/usr/bin/env python3
"""5.0a.2 (3ª rodada): amostras de voz em inglês e espanhol (tools/vozes/idiomas.json), para decidir o caminho da onda de idiomas.
Etapas (--etapa), no venv do Kokoro (.tools/vozes/venv):
  kokoro  sintetiza no Kokoro as 5 saudações de líder e os 2 avisos do locutor de cada Raça em en e es (vozes por papel do elenco) e as
          referências em pt-BR para o Chatterbox clonar: a voz do elenco feita pelo próprio Kokoro (saudação + uma frase), nunca de uma pessoa.
  assar   (depois de tools/vozes/cb_gerar.py, no venv do Chatterbox) apara, nivela, assa o caráter da Raça, grava OGG/MP3 em
          work/vozes/idiomas/<modelo>/<idioma>/, decodifica e confere por transcrição (Whisper small no idioma certo); junta tempos de CPU,
          a semelhança de voz medida pelo cb_gerar.py e a estimativa para as 742 falas × 3 idiomas no manifesto (chave 'idiomas').
Uso: .tools/vozes/venv/bin/python tools/vozes/idiomas.py --etapa kokoro|assar [--vorag vorag-c]"""
import os, sys, json, time
sys.argv = [sys.argv[0]] + [a for a in sys.argv[1:]]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gerar as G
import racas as RC
import numpy as np, soundfile as sf
ID = json.load(open(os.path.join(G.ROOT, 'tools', 'vozes', 'idiomas.json'), encoding='utf-8'))
BASE = os.path.join(G.T, 'tmp', 'idiomas'); OUTI = os.path.join(G.OUT, 'idiomas')
ETAPA = G.arg('--etapa', 'kokoro'); VORAG = G.arg('--vorag', 'vorag')
ES = {'pf_dora': 'ef_dora', 'pm_alex': 'em_alex', 'pm_santa': 'em_santa'}
LANG = {'pt': 'p', 'es': 'e'}

def papeis():
    """(raça, papel, idioma) -> (pesos, velocidade, g2p) do Kokoro; pt e es pelo elenco (racas.ELENCO), en pelo idiomas.json"""
    out = {}
    for r in RC.RACAS:
        e = RC.ELENCO[r]
        for papel, pk, vk in (('lider', 'lider_pesos', 'lider_vel'), ('locutor', 'locutor_pesos', 'locutor_vel')):
            out[(r, papel, 'pt')] = (e[pk], e[vk], 'p')
            out[(r, papel, 'es')] = ({ES[v]: w for v, w in e[pk].items()}, e[vk], 'e')
            k = ID['kokoro']['en'][r][papel]; out[(r, papel, 'en')] = (k['pesos'], k['vel'], k['g2p'])
    return out

def textos():
    """lista de (raça, papel, id da fala, {idioma: texto})"""
    L = []
    for r in RC.RACAS:
        L.append((r, 'lider', 'lider', ID['lideres'][r]))
        for f in ID['locutor']: L.append((r, 'locutor', f['id'], {k: f[k] for k in ('pt', 'en', 'es')}))
    return L

def nome(r, papel, fid): return r + '-' + ('lider' if papel == 'lider' else 'locutor-' + fid)

def etapa_kokoro():
    import torch
    from kokoro import KModel, KPipeline
    torch.set_num_threads(G.THREADS)
    d = os.path.join(G.MOD, 'kokoro'); model = KModel(repo_id='hexgrad/Kokoro-82M', config=os.path.join(d, 'config.json'), model=os.path.join(d, 'kokoro-v1_0.pth')).eval()
    pipes = {c: KPipeline(lang_code=c, repo_id='hexgrad/Kokoro-82M', model=model) for c in ('p', 'e', 'a', 'b')}; packs = {}
    def pack(pipe, pesos):
        k = tuple(sorted(pesos.items()))
        if k not in packs: packs[k] = sum(w * pipe.load_single_voice(os.path.join(d, 'voices', v + '.pt')) for v, w in pesos.items())
        return packs[k]
    def falar(txt, pesos, vel, g2p):
        p = pipes[g2p]
        with torch.no_grad(): parts = [r.audio.numpy() for r in p(txt, voice=pack(p, pesos), speed=vel) if r.audio is not None]
        return np.concatenate(parts).astype(np.float32)
    for c in pipes: falar('Ok.' if c in 'ab' else 'Teste.', {'pm_alex': 1.0} if c in 'pe' else {'am_michael': 1.0}, 1.0, c)  # aquecimento (G2P, espeak, spaCy)
    P = papeis(); reg = {}; feitos = {}
    for r, papel, fid, tx in textos():
        for lg in ('en', 'es'):
            pesos, vel, g2p = P[(r, papel, lg)]; chave = (tuple(sorted(pesos.items())), vel, g2p, tx[lg]); arq = os.path.join(BASE, 'kokoro', lg, nome(r, papel, fid) + '.wav'); os.makedirs(os.path.dirname(arq), exist_ok=True)
            if chave in feitos:
                sf.write(arq, *feitos[chave][:2]); reg[arq] = feitos[chave][2]; continue
            t, tc = time.time(), time.process_time(); y = falar(tx[lg], pesos, vel, g2p); dt, dc = time.time() - t, time.process_time() - tc
            y = G.aparar(y, 24000); sf.write(arq, y, 24000, subtype='PCM_16'); info = dict(sintese_s=round(dt, 2), cpu_s=round(dc, 2), dur_s=round(len(y) / 24000, 2), pesos=pesos, vel=vel, g2p=g2p)
            feitos[chave] = (y, 24000, info); reg[arq] = info; print(f"kokoro {lg} {nome(r, papel, fid):28} {info['dur_s']:5.2f} s · CPU {dc:5.1f} s · {tx[lg]}", flush=True)
        # referência em pt-BR para o Chatterbox: a voz do elenco feita pelo Kokoro (fala + frase extra, ~6 a 9 s)
        if papel == 'lider' or fid == ID['locutor'][0]['id']:
            pesos, vel, g2p = P[(r, papel, 'pt')]; ref = os.path.join(BASE, 'ref', r + '-' + papel + '.wav'); os.makedirs(os.path.dirname(ref), exist_ok=True)
            txt = (tx['pt'] if papel == 'lider' else ' '.join(f['pt'] for f in ID['locutor'])) + ' ' + ID['referencia_extra']
            y = G.aparar(falar(txt, pesos, vel, 'p'), 24000); y, _ = G.nivelar(y, 24000); sf.write(ref, y, 24000, subtype='PCM_16'); print(f"referência {r}-{papel}: {len(y) / 24000:.1f} s · {txt}", flush=True)
    json.dump({k: v for k, v in reg.items()}, open(os.path.join(BASE, 'kokoro-tempos.json'), 'w'), ensure_ascii=False, indent=1)

def transcrever(wav, texto, lg):
    w = G.whisper(); segs, _ = w.transcribe(wav, language=lg, beam_size=5, initial_prompt=ID['vocabulario'][lg] + '.', condition_on_previous_text=False, vad_filter=False)
    hyp = ' '.join(s.text.strip() for s in segs).strip(); r, h = G.norm(texto), G.norm(hyp)
    return dict(asr=hyp, cer=round(G.lev(r, h) / max(1, len(r)), 3))

def etapa_assar():
    man, p = G.manifesto(); kt = json.load(open(os.path.join(BASE, 'kokoro-tempos.json'), encoding='utf-8')); cb = dict(info={}, tempos={}, semelhanca={})
    for lg in ('en', 'es'):  # um arquivo por processo do cb_gerar.py
        f = os.path.join(BASE, 'chatterbox-' + lg + '.json')
        if not os.path.exists(f): continue
        x = json.load(open(f, encoding='utf-8')); cb['info'][lg] = x['info']; cb['tempos'].update(x['tempos'])
        for r, papeis in x['semelhanca'].items():
            for papel, v in papeis.items(): cb['semelhanca'].setdefault(r, {}).setdefault(papel, {}).update(v)
    info = next(iter(cb['info'].values()), {}); info = dict(info, por_idioma=cb['info'])
    bl = os.path.join(G.T, 'cache', 'hf', 'hub', 'models--ResembleAI--chatterbox', 'blobs')  # tamanho real dos pesos (o cb_gerar.py somava blobs e links)
    if os.path.isdir(bl): info['modelo_gb'] = round(sum(os.path.getsize(os.path.join(bl, f)) for f in os.listdir(bl)) / 1e9, 2)
    I = dict(gerado=time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()), vorag=VORAG, glossario=ID['glossario'], itens={}, chatterbox=info, semelhanca=cb.get('semelhanca', {}))
    for modelo in ('kokoro', 'chatterbox'):
        for lg in (('en', 'es') if modelo == 'kokoro' else ('pt', 'en', 'es')):
            for r, papel, fid, tx in textos():
                n = nome(r, papel, fid); src = os.path.join(BASE, modelo, lg, n + '.wav')
                if not os.path.exists(src): continue
                x, sr = sf.read(src, dtype='float64'); x = G.aparar(x, sr); x, _ = G.nivelar(x, sr); raca = VORAG if r == 'vorag' else r
                s48 = RC.para48(x, sr); reg = RC.regiao_fala(s48, RC.SR); y, pre = RC.assar(raca, x, sr); y, _ = G.nivelar(y, RC.SR)
                base = os.path.join(OUTI, modelo, lg, n); os.makedirs(os.path.dirname(base), exist_ok=True); wav = os.path.join(G.T, 'tmp', 'idi.wav'); sf.write(wav, y, RC.SR, subtype='PCM_16')
                ob, mb = G.codificar(wav, base, raca in RC.ESTEREO); d, dsr = G.decodificar(base + '.ogg'); dw = os.path.join(G.T, 'tmp', 'idi-dec.wav'); sf.write(dw, d, dsr, subtype='PCM_16')
                med = RC.medir(d, dsr, (reg[0] + pre, reg[1] + pre), RC.pausas_da_seca(s48, RC.SR, reg), pre); sw = os.path.join(G.T, 'tmp', 'idi-seco.wav'); sf.write(sw, x, sr, subtype='PCM_16')
                med.update(transcrever(dw, tx[lg], lg)); med['seco'] = transcrever(sw, tx[lg], lg); med.update(texto=tx[lg], ogg_b=ob, mp3_b=mb, f0_seco_hz=G.f0_mediana(x, sr))
                tempo = (kt.get(src) if modelo == 'kokoro' else cb.get('tempos', {}).get(src)) or {}; med.update({k: tempo[k] for k in ('sintese_s', 'cpu_s', 'dur_s') if k in tempo})
                I['itens'].setdefault(modelo, {}).setdefault(lg, {})[n] = med
                print(f"{modelo:10} {lg} {n:28} CER {med['cer']} (seca {med['seco']['cer']}) · F0 {med['f0_seco_hz']} · «{med['asr']}»", flush=True)
    # tempo de CPU por segundo de fala e estimativa para as 742 falas × 3 idiomas (32 min de fala em pt-BR no plano)
    est = {}
    for modelo, por in I['itens'].items():
        for lg, its in por.items():
            c = sum(v.get('cpu_s', 0) for v in its.values()); s = sum(v.get('dur_s', 0) for v in its.values())
            if s: est.setdefault(modelo, {})[lg] = dict(cpu_por_s=round(c / s, 2), fala_s=round(s, 1), cer=round(float(np.mean([v['cer'] for v in its.values()])), 3), cer_seco=round(float(np.mean([v['seco']['cer'] for v in its.values()])), 3))
    I['estimativa'] = est; man['idiomas'] = I; G.gravar_manifesto(man, p)

if __name__ == '__main__':
    {'kokoro': etapa_kokoro, 'assar': etapa_assar}[ETAPA]()
