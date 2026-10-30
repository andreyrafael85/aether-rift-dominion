#!/usr/bin/env python3
"""5.0c.1: as falas gravadas do jogo, chamadas pelo gerar.py (--etapa jogo | manifesto | formato), no venv do Kokoro (.tools/vozes/venv).

jogo       gera um idioma inteiro do roteiro (tools/vozes/roteiro.json, montado pelo tools/vozes/roteiro.cjs):
           Kokoro-82M na voz do elenco (racas.voz_do_papel) → apara o silêncio das pontas e nivela (nível ativo −20 dBFS, pico −1 dBFS) →
           caráter da Raça assado (racas.assado_do_papel: Vorag na variante C, Erevane com o eco mais leve fora do líder) → nivela de novo →
           mestres sem perda (FLAC 16 bits: o assado a 48 kHz e o seco a 24 kHz, em .tools/vozes/mestres/<idioma>/) → Opus 24 kbps em Ogg
           (mono; o Quorith em estéreo) em assets/vozes/<idioma>/<pacote>/<id>.ogg → decodifica o arquivo final e confere pelo Whisper small
           (CPU, int8) no idioma certo, com os tempos de cada palavra. A conferência vai em lotes de até 10 falas por janela de 30 s (o custo
           do Whisper é o da janela: 1 fala leva 7,3 s e 8 falas 8,6 s nesta máquina); a fala que passa do limite é reconferida sozinha e,
           se ainda falhar, regravada até 2 vezes com outra semente e outra velocidade (×0,94 e ×1,06), ficando a melhor das três.
           Retomável: o estado fica em work/vozes-jogo/<idioma>/estado.json; uma fala com a mesma assinatura (texto falado, vozes, velocidade,
           caráter e taxa) e com os arquivos no lugar é pulada. Parar no meio só perde o lote em andamento.
manifesto  assets/vozes/<idioma>/manifesto.json (o contrato com quem toca as vozes) e work/vozes-jogo/numeros.json (tamanho e duração).
formato    --formato m4a (AAC ~40 kbps) ou mp3 (48 kbps): a mesma árvore no outro formato, a partir dos mestres, sem gerar de novo; o
           manifesto ganha o formato em "formatos". --saida <pasta> grava noutra pasta (teste).
           Decisão de 30/10/2026 (bancada no iPhone do dono, iOS 18.7: o Safari decodifica Opus em Ogg pelo Web Audio): o jogo fica só com o
           Opus; esta etapa fica para o futuro e não foi rodada.

Limite da conferência (por fala, no texto falado e no que o Whisper ouviu, os dois sem acento, pontuação e caixa): erro por caractere acima de
15% do texto ou de 2 caracteres, o que for maior. Justificativa no work/RELATORIO.md: o Kokoro seco erra 0,8 a 1,6% em média, quase tudo em nomes
inventados (1 ou 2 letras: "Kessari" → "Késsari" não conta, mas "Basis" por "Base" conta); 15% é uma palavra curta trocada ou engolida numa
fala de 4 a 6 palavras, e os 2 caracteres seguram as falas de uma palavra ("Fome.", "Uníssono!"), em que uma letra já seria 20%."""
import os, sys, json, time, re, hashlib, subprocess, shutil
import numpy as np, soundfile as sf
from scipy.signal import resample_poly

G = None; RC = None  # módulos gerar e racas, entregues pelo gerar.py
IDIOMAS = ['pt-BR', 'en', 'es']
LANG = {'pt-BR': 'pt', 'en': 'en', 'es': 'es'}
KBPS = {'mono': 24, 'estereo': 32}  # Opus do jogo; o Quorith em 32: em 24 kbps o libopus junta o estéreo (lado −8,3 → −22,4 dB) e o coro fica quase mono
TENTATIVAS = [(0, 1.0), (1, 0.94), (2, 1.06)]  # (semente, fator de velocidade): a 1ª e as duas regravações
LOTE_MAX, LOTE_S, VAO = 10, 24.0, 0.8  # conferência em lote: até 10 falas e 24 s de fala por janela, 0,8 s de silêncio entre elas
PERIGO = {'Base sob ataque', 'Núcleo sob ataque', 'Alerta de sifão', 'Pacto quebrado', 'Blecaute', 'Fundição Orbital', 'Salto de Núcleo'}
MAIS = {'pt-BR': 'mais', 'en': 'plus', 'es': 'más'}
VERSAO = 'jogo-1'


def caminhos(idioma):
    R = G.ROOT; T = G.T
    return dict(rot=os.path.join(R, 'tools', 'vozes', 'roteiro.json'), assets=os.path.join(R, 'assets', 'vozes', idioma), mestres=os.path.join(T, 'mestres', idioma),
                work=os.path.join(R, 'work', 'vozes-jogo', idioma), tmp=os.path.join(T, 'tmp', 'v-gravar-' + idioma))


def ler_json(p, padrao):
    try:
        with open(p, encoding='utf-8') as f: return json.load(f)
    except FileNotFoundError: return padrao


def gravar_json(p, obj, indent=None):
    os.makedirs(os.path.dirname(p), exist_ok=True); t = p + '.tmp'
    with open(t, 'w', encoding='utf-8') as f: json.dump(obj, f, ensure_ascii=False, indent=indent)
    os.replace(t, p)


def dizer(f, idioma, pron):
    """o texto que o Kokoro lê: o da legenda sem o ⚡, com +N por extenso e a pontuação final que faltar (! nos perigos e eventos de hoje)"""
    t = re.sub(r'\s+', ' ', f['texto'][idioma].replace('⚡', '')).strip(); t = re.sub(r'\+(\d)', MAIS[idioma] + r' \1', t)
    if not re.search(r'[.!?…]$', t): t += '!' if f['chave'] in PERIGO else '.'
    for a, b in (pron or {}).items(): t = re.sub(r'\b' + re.escape(a) + r'\b', b, t)
    return t


def limite(ref):
    return max(0.15, 2.0 / max(1, len(ref)))


# ---------- áudio ----------
def ff(args, entrada=None):
    return subprocess.run([G.FF, '-hide_banner', '-loglevel', 'error', '-y'] + args, input=entrada, capture_output=True, check=True).stdout


def opus(y, arq, estereo):
    ch = 2 if estereo else 1; y = np.asarray(y, np.float32); y = y if y.ndim == 2 else y[:, None]
    if y.shape[1] != ch: y = np.repeat(y.mean(1, keepdims=True), ch, 1)
    os.makedirs(os.path.dirname(arq), exist_ok=True)
    ff(['-f', 'f32le', '-ar', '48000', '-ac', str(ch), '-i', '-', '-map_metadata', '-1', '-c:a', 'libopus', '-b:a', '%dk' % KBPS['estereo' if estereo else 'mono'], '-vbr', 'on', '-application', 'audio', arq], y.tobytes())


def decodificar(arq, ch):
    b = ff(['-i', arq, '-f', 'f32le', '-ac', str(ch), '-ar', '48000', '-']); y = np.frombuffer(b, np.float32)
    return y.reshape(-1, ch) if ch == 2 else y


def para16k(y48):
    m = y48.mean(1) if y48.ndim == 2 else y48; return resample_poly(m, 1, 3).astype(np.float32)


# ---------- Kokoro ----------
class Voz:
    def __init__(self, idioma):
        import torch; self.torch = torch; torch.set_num_threads(G.THREADS)
        try: torch.set_num_interop_threads(1)
        except RuntimeError: pass
        from kokoro import KModel, KPipeline
        d = os.path.join(G.MOD, 'kokoro'); self.d = d
        self.model = KModel(repo_id='hexgrad/Kokoro-82M', config=os.path.join(d, 'config.json'), model=os.path.join(d, 'kokoro-v1_0.pth')).eval()
        cods = {'pt-BR': 'p', 'es': 'e', 'en': 'ab'}[idioma]
        self.pipes = {c: KPipeline(lang_code=c, repo_id='hexgrad/Kokoro-82M', model=self.model) for c in cods}; self.packs = {}
        for c in cods: self.falar('Ok.' if c in 'ab' else 'Teste.', {'am_michael' if c in 'ab' else 'pm_alex': 1.0}, 1.0, c, 0)  # aquecimento (G2P, espeak, spaCy)

    def pack(self, c, pesos):
        k = (c, tuple(sorted(pesos.items())))
        if k not in self.packs: self.packs[k] = sum(w * self.pipes[c].load_single_voice(os.path.join(self.d, 'voices', v + '.pt')) for v, w in pesos.items())
        return self.packs[k]

    def falar(self, txt, pesos, vel, c, semente):
        self.torch.manual_seed(semente)
        with self.torch.no_grad(): parts = [r.audio.numpy() for r in self.pipes[c](txt, voice=self.pack(c, pesos), speed=vel) if r.audio is not None]
        return np.concatenate(parts).astype(np.float32) if parts else np.zeros(2400, np.float32)


# ---------- Whisper ----------
_W = None
def whisper():
    global _W
    if _W is None:
        from faster_whisper import WhisperModel
        _W = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=G.THREADS, num_workers=1, download_root=os.path.join(G.MOD, 'whisper'))
    return _W


def vocab(idioma):
    I = ler_json(os.path.join(G.ROOT, 'tools', 'vozes', 'idiomas.json'), {}); v = (I.get('vocabulario') or {}).get(LANG[idioma], '')
    return v + ', Oryn, Vey, Vassi, Quor, Ísk, Erevane, Tessara, Quorith, Vorag.'


def transcrever(audios, idioma):
    """confere uma ou mais falas (mono, 16 kHz) numa janela só: devolve para cada uma (texto ouvido, [(início, fim, palavra)] relativos à fala)"""
    sr = 16000; vao = np.zeros(int(VAO * sr), np.float32); partes, offs = [], []; t = 0.0
    for a in audios: offs.append(t); partes += [a, vao]; t += (len(a) + len(vao)) / sr
    segs, _ = whisper().transcribe(np.concatenate(partes), language=LANG[idioma], beam_size=5, word_timestamps=True, initial_prompt=vocab(idioma), condition_on_previous_text=False, vad_filter=False)
    ws = [(w.start, w.end, w.word) for s in segs for w in (s.words or [])]; out = []; usadas = set()
    for i, a in enumerate(audios):
        ini, fim = offs[i] - 0.25, offs[i] + len(a) / sr + VAO * 0.45; meu = []
        for j, (s, e, w) in enumerate(ws):
            if j in usadas: continue
            if ini <= (s + e) / 2 <= fim: meu.append((max(0.0, s - offs[i]), max(0.0, e - offs[i]), w.strip())); usadas.add(j)
        out.append((' '.join(w for _, _, w in meu).strip(), meu))
    return out


N2W = {'pt-BR': 'pt_BR', 'en': 'en', 'es': 'es'}
PCT = {'pt-BR': ' por cento', 'en': ' percent', 'es': ' por ciento'}


def numeros(s, idioma):
    """números por extenso nos dois lados da conferência ("Dois mil" e "2000", "100%" e "cem por cento" contam igual)"""
    from num2words import num2words
    s = re.sub(r'(\d)\s*%', r'\1' + PCT[idioma], s)
    def ext(m):
        t = re.sub(r'[.,](?=\d{3}\b)', '', m.group(0))
        try: return ' ' + num2words(int(t), lang=N2W[idioma]) + ' '
        except (ValueError, NotImplementedError, OverflowError): return m.group(0)
    return re.sub(r'\b\d[\d.,]*\d\b|\b\d\b', ext, s)


IDIOMA = None
# grafias do Whisper para a MESMA pronúncia (conferidas no piloto e na rodada): "Blecaute" é a palavra adaptada de "blackout" e o Whisper a escreve
# em inglês ou como se ouve ("blecauchi"); "sob ataque" e "no ar" ditos ligados viram uma palavra só; "Pact"/"packed" e "route"/"root" soam igual
# em inglês americano; algarismos romanos no lugar do número das Eras. Lista curta e explícita, para não esconder erro de verdade.
EQUIV = {'pt-BR': {'blackout': 'blecaute', 'blackouti': 'blecaute', 'blecauchi': 'blecaute', 'sobataki': 'sob ataque', 'sobataque': 'sob ataque', 'noir': 'no ar', 'ii': 'dois', 'iii': 'tres'},
         'en': {'packed': 'pact', 'root': 'route', 'ii': 'two', 'iii': 'three'}, 'es': {'ii': 'dos', 'iii': 'tres'}}


def cer(ref, hyp, idioma=None):
    idioma = idioma or IDIOMA; r, h = G.norm(numeros(ref, idioma)), G.norm(numeros(hyp, idioma)); eq = EQUIV.get(idioma) or {}
    if eq: h = ' '.join(eq.get(w, w) for w in h.split())
    return round(G.lev(r, h) / max(1, len(r)), 3), r


def etapa_reconferir(idiomas):
    """recalcula o erro e o limite de cada fala pelo texto já ouvido (e['asr']), com as equivalências de hoje, sem gerar nem transcrever de novo"""
    for idioma in idiomas:
        P = caminhos(idioma); ep = os.path.join(P['work'], 'estado.json'); E = ler_json(ep, {}); mud = 0
        RF = {f['id']: dizer(f, idioma, None) for f in ler_json(P['rot'], {}).get('falas', [])}  # a legenda como referência, sem as trocas de pronúncia
        for i, e in E.items():
            e['ref'] = RF.get(i, e['dito']); c, ref = cer(e['ref'], e['asr'], idioma); ok = c <= limite(ref)
            if c != e['cer'] or ok != e['ok']: e.setdefault('cer_bruto', e['cer']); e['cer'], e['ok'] = c, ok; mud += 1
        gravar_json(ep, E); print(f"reconferir {idioma}: {len(E)} falas · {mud} mudaram · {sum(1 for e in E.values() if not e['ok'])} acima do limite", flush=True)


def alinhar(texto, palavras, dur, regiao):
    """os tempos de cada palavra da legenda (texto) a partir das palavras que o Whisper ouviu: alinhamento letra a letra (Levenshtein, sem
    acento nem pontuação); palavra sem par fica entre as vizinhas, pelo tamanho. Sem nada ouvido, a fala inteira dividida pelo tamanho."""
    ref = texto.split(); rc, ri = [], []
    for i, w in enumerate(ref):
        for ch in G.norm(w).replace(' ', ''): rc.append(ch); ri.append(i)
    hc, ht = [], []
    for s, e, w in palavras:
        n = G.norm(w).replace(' ', ''); k = max(1, len(n))
        for j, ch in enumerate(n): hc.append(ch); ht.append((s + (e - s) * j / k, s + (e - s) * (j + 1) / k))
    tem = [None] * len(ref)
    if rc and hc:
        n, m = len(rc), len(hc); D = np.zeros((n + 1, m + 1), np.int32); D[:, 0] = np.arange(n + 1); D[0, :] = np.arange(m + 1)
        for i in range(1, n + 1):
            for j in range(1, m + 1): D[i, j] = min(D[i - 1, j] + 1, D[i, j - 1] + 1, D[i - 1, j - 1] + (rc[i - 1] != hc[j - 1]))
        i, j, par = n, m, [None] * n
        while i > 0 and j > 0:
            if D[i, j] == D[i - 1, j - 1] + (rc[i - 1] != hc[j - 1]): par[i - 1] = j - 1; i -= 1; j -= 1
            elif D[i, j] == D[i - 1, j] + 1: i -= 1
            else: j -= 1
        for k, p in enumerate(par):
            if p is None: continue
            w = ri[k]; a, b = ht[p]; tem[w] = (min(tem[w][0], a), max(tem[w][1], b)) if tem[w] else (a, b)
    pesos = [max(1, len(G.norm(w).replace(' ', ''))) for w in ref]
    if not any(tem):  # nada ouvido: a região da fala dividida pelo tamanho das palavras
        a, b = regiao; tot = sum(pesos); t = a; out = []
        for w, p in zip(ref, pesos): d = (b - a) * p / tot; out.append([round(t, 2), round(t + d, 2), w]); t += d
        return out
    for i in range(len(ref)):  # buracos: entre as vizinhas, pelo tamanho
        if tem[i]: continue
        j = i
        while j < len(ref) and not tem[j]: j += 1
        a = tem[i - 1][1] if i > 0 and tem[i - 1] else (regiao[0] if j < len(ref) else regiao[0])
        b = tem[j][0] if j < len(ref) else max(a + 0.1, regiao[1])
        tot = sum(pesos[i:j]); t = a
        for k in range(i, j): d = max(0.0, b - a) * pesos[k] / tot; tem[k] = (t, t + d); t += d
    out, ult = [], 0.0
    for w, (a, b) in zip(ref, tem):
        a = min(max(a, ult, 0.0), dur); b = min(max(b, a + 0.05), dur); out.append([round(a, 2), round(b, 2), w]); ult = a
    return out


# ---------- etapa jogo ----------
def assinatura(txt, pesos, vel, g2p, assado, estereo):
    s = json.dumps([VERSAO, txt, sorted(pesos.items()), vel, g2p, assado, KBPS['estereo' if estereo else 'mono']], ensure_ascii=False)
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:16]


def selecionar(falas, so):
    if not so: return falas
    S = set(so.split(',')); return [f for f in falas if f['id'] in S or f['tipo'] in S or f['raca'] in S or f['pacote'] in S or f['chave'] in S]


def etapa_jogo(idioma):
    global IDIOMA; IDIOMA = idioma
    P = caminhos(idioma); R = ler_json(P['rot'], None)
    if not R: raise SystemExit('falta tools/vozes/roteiro.json: rode node tools/vozes/roteiro.cjs')
    ID = ler_json(os.path.join(G.ROOT, 'tools', 'vozes', 'idiomas.json'), {}); EN = ID['kokoro']['en']
    pron = (ler_json(os.path.join(G.ROOT, 'tools', 'vozes', 'falas-jogo.json'), {}).get('pronuncia') or {}).get(idioma, {})
    os.makedirs(P['tmp'], exist_ok=True); os.makedirs(P['work'], exist_ok=True)
    est_p = os.path.join(P['work'], 'estado.json'); E = ler_json(est_p, {})
    refazer = '--refazer' in G.ARGS; falas = selecionar(R['falas'], G.arg('--so'))
    plano = []
    for f in falas:
        quem = f['quem']; pesos, vel, g2p = RC.voz_do_papel(f['raca'], quem, idioma, f.get('classe'), EN); assado = RC.assado_do_papel(f['raca'], quem)
        est = f['raca'] in RC.ESTEREO; txt = dizer(f, idioma, pron); ass = assinatura(txt, pesos, vel, g2p, assado, est)
        ogg = os.path.join(P['assets'], f['pacote'], f['id'] + '.ogg'); mest = os.path.join(P['mestres'], f['pacote'], f['id'] + '.flac')
        e = E.get(f['id'])
        if not refazer and e and e.get('assin') == ass and os.path.exists(ogg) and os.path.exists(mest): continue
        plano.append(dict(f=f, pesos=pesos, vel=vel, g2p=g2p, assado=assado, est=est, txt=txt, ref=dizer(f, idioma, None), assin=ass, ogg=ogg, mest=mest, seco=os.path.join(P['mestres'], 'seco', f['id'] + '.flac')))
    print(f"[{idioma}] {len(falas)} falas no roteiro selecionado · {len(plano)} a gerar · {len(falas) - len(plano)} já prontas", flush=True)
    if not plano: return
    t_ini = time.time(); c_ini = time.process_time(); V = Voz(idioma); whisper(); carga = time.time() - t_ini
    print(f"[{idioma}] modelos carregados em {carga:.1f} s", flush=True)
    tempos = dict(sintese_cpu=0.0, assar_cpu=0.0, whisper_cpu=0.0, whisper_rel=0.0, falas=0, fala_s=0.0, regravadas=0, reconferidas=0)
    feitas = 0

    def tomar(p, k):
        """uma tomada: sintetiza, apara, nivela, assa, nivela, grava o Opus num arquivo temporário e decodifica o que o jogador vai ouvir"""
        sem, fv = TENTATIVAS[k]; c0 = time.process_time()
        x = V.falar(p['txt'], p['pesos'], round(p['vel'] * fv, 3), p['g2p'], sem); x = G.aparar(x, 24000); x, _ = G.nivelar(x, 24000); c1 = time.process_time()
        y, pre = RC.assar(p['assado'], x, 24000); y, pk = G.nivelar(y, RC.SR); c2 = time.process_time()
        tmp = os.path.join(P['tmp'], p['f']['id'] + '-t%d.ogg' % k); opus(y, tmp, p['est']); d = decodificar(tmp, 2 if p['est'] else 1)
        tempos['sintese_cpu'] += c1 - c0; tempos['assar_cpu'] += c2 - c1
        return dict(k=k, semente=sem, vel=round(p['vel'] * fv, 3), seco=x, assado=y, pico=round(pk, 1), tmp=tmp, dec=d, a16=para16k(d), dur=round(len(d) / RC.SR, 3), pre=pre)

    def conferir(p, tk, res):
        c, ref = cer(p['ref'], res[0]); tk.update(asr=res[0], cer=c, palavras_w=res[1], ok=c <= limite(ref)); return tk  # a referência é a legenda (sem as trocas de pronúncia)

    def ouvir_whisper(lista):
        c0, t0 = time.process_time(), time.time(); r = transcrever(lista, idioma); tempos['whisper_cpu'] += time.process_time() - c0; tempos['whisper_rel'] += time.time() - t0; return r

    i, sobra = 0, None
    while i < len(plano) or sobra:
        lote, tot = [], 0.0  # lote: até LOTE_MAX falas ou LOTE_S segundos; a tomada que não coube abre o lote seguinte
        if sobra: lote.append(sobra); tot = sobra[1]['dur'] + VAO; sobra = None
        while i < len(plano) and len(lote) < LOTE_MAX:
            p = plano[i]; tk = tomar(p, 0); i += 1
            if lote and tot + tk['dur'] > LOTE_S: sobra = (p, tk); break
            lote.append((p, tk)); tot += tk['dur'] + VAO
        res = ouvir_whisper([tk['a16'] for _, tk in lote])
        for (p, tk), r in zip(lote, res):
            conferir(p, tk, r); tomadas = [tk]
            if not tk['ok']:  # reconfere sozinha (o lote pode ter cortado uma fala curta) e, se ainda falhar, regrava até 2 vezes
                tempos['reconferidas'] += 1; tk2 = dict(tk); conferir(p, tk2, ouvir_whisper([tk['a16']])[0]); tk2['so'] = True
                if tk2['cer'] <= tk['cer']: tomadas = [tk2]
                if not tk2['ok']:
                    for k in (1, 2):
                        tempos['regravadas'] += 1; t = tomar(p, k); conferir(p, t, ouvir_whisper([t['a16']])[0]); t['so'] = True; tomadas.append(t)
                        if t['ok']: break
            best = min(tomadas, key=lambda t: (t['cer'], t['k']))
            seco_cer = None
            if not best['ok']:  # ficou acima do limite: a voz seca diz se é a síntese ou o caráter da Raça
                a16 = resample_poly(best['seco'], 2, 3).astype(np.float32); c0 = time.process_time(); rs = transcrever([a16], idioma)[0]; tempos['whisper_cpu'] += time.process_time() - c0
                seco_cer = dict(cer=cer(p['ref'], rs[0])[0], asr=rs[0])
            # grava a melhor tomada: mestres (assado 48 kHz e seco 24 kHz, FLAC) e o Opus no lugar
            os.makedirs(os.path.dirname(p['mest']), exist_ok=True); os.makedirs(os.path.dirname(p['seco']), exist_ok=True); os.makedirs(os.path.dirname(p['ogg']), exist_ok=True)
            sf.write(p['mest'], best['assado'], RC.SR, subtype='PCM_16', format='FLAC'); sf.write(p['seco'], best['seco'], 24000, subtype='PCM_16', format='FLAC')
            shutil.move(best['tmp'], p['ogg'])
            for t in tomadas:
                if t is not best and os.path.exists(t['tmp']): os.remove(t['tmp'])
            reg = RC.regiao_fala(best['dec'].mean(1) if best['dec'].ndim == 2 else best['dec'], RC.SR)
            pal = alinhar(p['f']['texto'][idioma], best['palavras_w'], best['dur'], reg)
            E[p['f']['id']] = dict(assin=p['assin'], pacote=p['f']['pacote'], dur=best['dur'], ogg_b=os.path.getsize(p['ogg']), palavras=pal, cer=best['cer'], asr=best['asr'], ok=best['ok'],
                                   tomada=best['k'], semente=best['semente'], vel=best['vel'], pesos=p['pesos'], g2p=p['g2p'], assado=p['assado'], estereo=p['est'], dito=p['txt'], ref=p['ref'], pico_db=best['pico'],
                                   tentativas=[dict(k=t['k'], cer=t['cer'], asr=t['asr'], so=bool(t.get('so'))) for t in tomadas], seco=seco_cer, gerada=time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()))
            feitas += 1; tempos['falas'] += 1; tempos['fala_s'] += best['dur']
            print(f"[{idioma} {feitas}/{len(plano)}] {p['f']['id']:28} {best['dur']:5.2f} s · CER {best['cer']:.3f}{'' if best['ok'] else ' ACIMA'} · t{best['k']}{'·só' if best.get('so') else ''} · «{best['asr']}»" + (f" · seco {seco_cer['cer']:.3f} «{seco_cer['asr']}»" if seco_cer else ''), flush=True)
        gravar_json(est_p, E)
    tempos.update(relogio_s=round(time.time() - t_ini, 1), cpu_s=round(time.process_time() - c_ini, 1), carga_s=round(carga, 1), threads=G.THREADS, fim=time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()))
    tp = os.path.join(P['work'], 'tempos.json'); T = ler_json(tp, []); T.append({k: (round(v, 1) if isinstance(v, float) else v) for k, v in tempos.items()}); gravar_json(tp, T, 1)
    print(f"[{idioma}] fim: {feitas} falas em {tempos['relogio_s'] / 60:.1f} min (CPU {tempos['cpu_s'] / 60:.1f} min) · regravações {tempos['regravadas']}", flush=True)
    etapa_manifesto([idioma])


# ---------- manifesto ----------
def etapa_manifesto(idiomas):
    num = ler_json(os.path.join(G.ROOT, 'work', 'vozes-jogo', 'numeros.json'), {})
    for idioma in idiomas:
        P = caminhos(idioma); R = ler_json(P['rot'], None); E = ler_json(os.path.join(P['work'], 'estado.json'), {}); falas = {}
        for f in R['falas']:
            e = E.get(f['id']); arq = f"{f['pacote']}/{f['id']}.ogg"
            if not e or not os.path.exists(os.path.join(P['assets'], arq)): continue
            falas[f['id']] = dict(arq=arq, dur=round(e['dur'], 2), texto=f['texto'][idioma], palavras=e['palavras'], pacote=f['pacote'], raca=f['raca'], tipo=f['tipo'])
        chaves = {}
        for pac, ks in R['chaves'].items():
            for k, ids in ks.items():
                v = [i for i in ids if i in falas]
                if v: chaves.setdefault(pac, {})[k] = v
        formatos = ['ogg'] + [x for x in ('m4a', 'mp3') if falas and all(os.path.exists(os.path.join(P['assets'], v['arq'][:-4] + '.' + x)) for v in falas.values())]
        man = dict(versao='5.0c.1', idioma=idioma, formatos=formatos, falas=falas, chaves=chaves)
        gravar_json(os.path.join(P['assets'], 'manifesto.json'), man)
        pac = {}
        for i, v in falas.items():
            q = pac.setdefault(v['pacote'], dict(n=0, dur=0.0, ogg_b=0)); q['n'] += 1; q['dur'] += v['dur']; q['ogg_b'] += os.path.getsize(os.path.join(P['assets'], v['arq']))
            for x in formatos[1:]: q[x + '_b'] = q.get(x + '_b', 0) + os.path.getsize(os.path.join(P['assets'], v['arq'][:-4] + '.' + x))
        tot = dict(n=sum(q['n'] for q in pac.values()), dur=round(sum(q['dur'] for q in pac.values()), 1), ogg_b=sum(q['ogg_b'] for q in pac.values()), roteiro=len(R['falas']),
                   manifesto_b=os.path.getsize(os.path.join(P['assets'], 'manifesto.json')))
        for x in formatos[1:]: tot[x + '_b'] = sum(q.get(x + '_b', 0) for q in pac.values())
        # conferência do contrato: toda chave do roteiro com ao menos uma fala; tempos das palavras em ordem e dentro da duração do arquivo
        faltam = [pac + ' ' + k for pac, ks in R['chaves'].items() for k in ks if not chaves.get(pac, {}).get(k)]
        ruins = [i for i, v in falas.items() if not v['palavras'] or v['palavras'][-1][1] > v['dur'] + 0.01 or any(a[0] > a[1] or (j and a[0] < v['palavras'][j - 1][0]) for j, a in enumerate(v['palavras']))]
        nch = sum(len(ks) for ks in R['chaves'].values())
        num[idioma] = dict(total=tot, pacotes={k: dict(v, dur=round(v['dur'], 1)) for k, v in sorted(pac.items())}, conferencia=dict(chaves=nch, chaves_sem_fala=len(faltam), palavras_fora=ruins[:20]))
        print(f"manifesto {idioma}: {tot['n']}/{tot['roteiro']} falas · {tot['dur'] / 60:.1f} min · Opus {tot['ogg_b'] / 1024:.0f} KB · formatos {formatos} · chaves {nch - len(faltam)}/{nch} · palavras fora {len(ruins)}", flush=True)
    gravar_json(os.path.join(G.ROOT, 'work', 'vozes-jogo', 'numeros.json'), num, 1)


# ---------- segundo formato ----------
def etapa_formato(idiomas):
    fmt = G.arg('--formato')
    if fmt not in ('m4a', 'mp3'): raise SystemExit('--formato m4a ou mp3')
    saida = G.arg('--saida'); from concurrent.futures import ThreadPoolExecutor
    t0 = time.time(); n = 0
    for idioma in idiomas:
        P = caminhos(idioma); E = ler_json(os.path.join(P['work'], 'estado.json'), {}); base = os.path.join(saida, idioma) if saida else P['assets']; tarefas = []
        for i, e in E.items():
            src = os.path.join(P['mestres'], e['pacote'], i + '.flac'); dst = os.path.join(base, e['pacote'], i + '.' + fmt)
            if not os.path.exists(src): continue
            os.makedirs(os.path.dirname(dst), exist_ok=True); est = e.get('estereo')
            if fmt == 'm4a': a = ['-i', src, '-map_metadata', '-1', '-ac', '2' if est else '1', '-c:a', 'aac', '-b:a', '56k' if est else '40k', '-movflags', '+faststart', dst]
            else: a = ['-i', src, '-map_metadata', '-1', '-ac', '2' if est else '1', '-c:a', 'libmp3lame', '-b:a', '64k' if est else '48k', dst]
            tarefas.append(a)
        with ThreadPoolExecutor(3) as ex: list(ex.map(ff, tarefas))
        n += len(tarefas); print(f"formato {fmt} {idioma}: {len(tarefas)} arquivos em {base}", flush=True)
    print(f"formato {fmt}: {n} arquivos em {time.time() - t0:.0f} s", flush=True)
    if not saida: etapa_manifesto(idiomas)


def main(gerar_mod, etapa):
    global G, RC
    G = gerar_mod; import racas; RC = racas
    idi = G.arg('--idioma'); idiomas = [idi] if idi else IDIOMAS
    for x in idiomas:
        if x not in IDIOMAS: raise SystemExit('--idioma pt-BR, en ou es')
    if etapa == 'jogo':
        if not idi: raise SystemExit('--idioma pt-BR|en|es (um processo por idioma)')
        etapa_jogo(idi)
    elif etapa == 'manifesto': etapa_manifesto(idiomas)
    elif etapa == 'reconferir': etapa_reconferir(idiomas)
    else: etapa_formato(idiomas)
