"""5.0a.2 (2ª rodada): o caráter de cada Raça assado na geração das falas — o jogo só toca o arquivo — e as medidas de ruído e aspereza.

Por que assar: a voz do sistema não passa pelo Web Audio, então o filtro só serve às falas gravadas, que já saem por Raça (os pacotes de cada
Raça); na geração dá para usar ferramentas melhores (o tom do Vorag por PSOLA, sem os artefatos do deslocador por linha de atraso),
o som sai igual em todo navegador e não custa nada no jogo. Efeitos em numpy/scipy (BSD); tom do Vorag por PSOLA do Praat (praat-parselmouth, GPL-3.0, só na máquina de build).
Entrada: a fala aparada e nivelada do gerar.py, a 24 kHz; saída a 48 kHz (mono; o Quorith em estéreo), nivelada de novo pelo gerar.py.

Mudanças pedidas pelo dono em 24/10/2026:
- Vehnar: a mesma faixa de rádio (250 a 4.000 Hz), sem chiado nem estalos por baixo da voz e com bem menos saturação; só um clique e um
  chiado curto e baixo antes e depois da fala, nunca durante.
- Vorag: sem o ruído (saem a modulação de 38 Hz, a saturação forte e o deslocador em duas fases) e com menos grave: tom 3 semitons abaixo
  por PSOLA (antes 4, ao vivo), passa-alta em 70 Hz e graves +3 dB (antes +7); a aspereza vem de uma saturação leve em paralelo (só
  harmônicos); um expansor guiado pela voz seca segura as pausas. O WORLD (pyworld) foi medido e ficou de fora: trocava "Base" por "Basis".
- Erevane, Tessara e Quorith: os mesmos parâmetros das cadeias ao vivo da página (v1), agora assados; o eco da Erevane fica mono."""
import numpy as np
from scipy.signal import lfilter, sosfilt, butter, fftconvolve, resample_poly, hilbert, welch

SR = 48000
RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']
NOME = {'vehnar': 'Vehnar', 'erevane': 'Erevane', 'tessara': 'Tessara', 'quorith': 'Quorith', 'vorag': 'Vorag'}
ESTEREO = {'quorith'}
LINHAS_RACA = ['01-unidade-pronta', '03-base-sob-ataque', '06-unidade-selecionada', '10-barao-forja-2']  # as falas da faixa das Raças
VOZES_RACA = ['pf_dora', 'pm_alex', 'pm_santa']

# elenco proposto (para o dono confirmar): voz do Kokoro ou mistura com pesos, e velocidade. A Sylvia é a Dora; os outros quatro líderes são homens.
ELENCO = {
    'vehnar': dict(lider='Barão-Forja', lider_pesos={'pm_santa': 1.0}, lider_vel=0.95, locutor_pesos={'pm_alex': 1.0}, locutor_vel=1.0,
                   porque='Barão-Forja: a voz mais madura e grave (Santa), devagar, pelo rádio da fundição; o locutor é o Alex, a voz-base, mais jovem.'),
    'erevane': dict(lider='Vesper Ísk', lider_pesos={'pm_alex': 0.7, 'pm_santa': 0.3}, lider_vel=1.05, locutor_pesos={'pm_santa': 0.7, 'pm_alex': 0.3}, locutor_vel=1.0,
                    porque='Vesper Ísk: Alex com um pouco do Santa, mais rápido e seco, com eco e ar; o locutor (5.0c.2, pedido do dono: voz feminina só na Tessara) é o Santa com um pouco do Alex, em ritmo normal, distinto do líder.'),
    'tessara': dict(lider='Sylvia Oriel', lider_pesos={'pf_dora': 1.0}, lider_vel=0.95, locutor_pesos={'pf_dora': 0.8, 'pm_santa': 0.2}, locutor_vel=1.05,
                    porque='Sylvia Oriel: a Dora, sem pressa, quente e orgânica; a locutora é a Dora com 20% do Santa e mais rápida, para não confundir com a líder.'),
    'quorith': dict(lider='Zayin Coral', lider_pesos={'pm_alex': 0.5, 'pm_santa': 0.5}, lider_vel=1.0, locutor_pesos={'pm_alex': 1.0}, locutor_vel=1.0,
                    porque='Zayin Coral: meio Alex, meio Santa, uma voz neutra que o coro multiplica; o locutor é o Alex.'),
    'vorag': dict(lider='Oru Voraz', lider_pesos={'pm_santa': 0.6, 'pm_alex': 0.4}, lider_vel=0.9, locutor_pesos={'pm_alex': 1.0}, locutor_vel=1.0,
                  porque='Oru Voraz: Santa com Alex, a mais lenta, com o grave áspero do Vorag; o locutor é o Alex no mesmo grave, em ritmo normal.'),
}
LOCUTOR_FALAS = [('01-unidade-pronta', 'Unidade pronta.'), ('03-base-sob-ataque', 'Base sob ataque!')]


# ---------- filtros e efeitos ----------
def rbj(tipo, f0, q=0.7071, ganho=0.0, sr=SR):
    """biquad do livro de receitas RBJ (o mesmo do BiquadFilterNode): pico, graves, agudos, passa-baixa, passa-alta"""
    A = 10 ** (ganho / 40); w = 2 * np.pi * f0 / sr; cw, sw = np.cos(w), np.sin(w); al = sw / (2 * q)
    if tipo == 'pico':
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif tipo in ('graves', 'agudos'):
        r = 2 * np.sqrt(A) * al; s = 1 if tipo == 'graves' else -1
        b = [A * ((A + 1) - s * (A - 1) * cw + r), s * 2 * A * ((A - 1) - s * (A + 1) * cw), A * ((A + 1) - s * (A - 1) * cw - r)]
        a = [(A + 1) + s * (A - 1) * cw + r, -s * 2 * ((A - 1) + s * (A + 1) * cw), (A + 1) + s * (A - 1) * cw - r]
    elif tipo == 'passa-baixa':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif tipo == 'passa-alta':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    else:
        raise ValueError(tipo)
    a = np.asarray(a, float); return np.asarray(b, float) / a[0], a / a[0]


def eq(x, *etapas, sr=SR):
    for e in etapas:
        b, a = rbj(*e, sr=sr); x = lfilter(b, a, x)
    return x


def satura(x, k, ass=0.0):
    """saturação tanh com 4× de sobreamostragem (sem dobra de frequências), normalizada para ±1 como a curva da página"""
    u = resample_poly(x, 4, 1); nk = np.tanh(k * (1 + ass)) - np.tanh(k * ass)
    y = (np.tanh(k * (u + ass)) - np.tanh(k * ass)) / nk
    return resample_poly(y, 1, 4)[:len(x)]


def atraso_var(x, base, prof, freq, sr=SR):
    """linha de atraso que oscila (coro, vibrato): base ± prof segundos num seno de freq Hz, com interpolação linear"""
    n = np.arange(len(x)); d = (base + prof * np.sin(2 * np.pi * freq * n / sr)) * sr; idx = n - d
    i0 = np.floor(idx).astype(int); fr = idx - i0; ok = i0 >= 0; i0c = np.clip(i0, 0, len(x) - 2)
    y = (1 - fr) * x[i0c] + fr * x[i0c + 1]; y[~ok] = 0.0
    return y


def eco(x, atraso, realim, corte, molhado, sr=SR):
    """eco com realimentação e passa-baixa no laço (o mesmo grafo da página): soma molhado · realim^(n-1) · PB^n(x atrasado n vezes)"""
    d = int(round(atraso * sr)); y = np.zeros(len(x)); b, a = rbj('passa-baixa', corte, 0.7071, sr=sr); c = x.copy(); g = molhado
    for _ in range(40):
        c = lfilter(b, a, np.concatenate([np.zeros(d), c[:-d]]))
        y += g * c; g *= realim
        if g < 1e-4: break
    return y


def sala(seg, decai, corte=None, semente=0, sr=SR):
    """resposta de sala em estéreo (ruído com queda (1 - t)^decai, passa-baixa de um polo se corte), já com a normalização do ConvolverNode"""
    rng = np.random.default_rng(semente); n = int(sr * seg); ir = np.zeros((2, n)); env = (1 - np.arange(n) / n) ** decai
    a = np.exp(-2 * np.pi * corte / sr) if corte else 0.0
    for k in range(2):
        w = (rng.random(n) * 2 - 1) * env; ir[k] = lfilter([1 - a], [1, -a], w) if a else w
    pot = max(np.sqrt((ir ** 2).sum() / (2 * n)), 0.000125)
    return ir * (1 / pot * 0.00125 * 44100 / sr * 0.5)


def ruido_curto(dur, nivel_db, f1=1500, f2=3500, semente=0, sr=SR):
    """chiado curto de rádio (ruído em faixa, ataque de 3 ms e queda exponencial) e um clique, para pôr antes e depois da fala"""
    rng = np.random.default_rng(semente); n = int(dur * sr); w = rng.standard_normal(n)
    w = sosfilt(butter(2, [f1, f2], btype='bandpass', fs=sr, output='sos'), w)
    env = np.minimum(1, np.arange(n) / (0.003 * sr)) * np.exp(-np.arange(n) / (0.35 * n)); w *= env
    w *= 10 ** (nivel_db / 20) / (np.abs(w).max() + 1e-12)
    clique = np.exp(-np.arange(int(0.004 * sr)) / (0.0008 * sr)) * np.sin(2 * np.pi * 2200 * np.arange(int(0.004 * sr)) / sr) * 10 ** ((nivel_db + 6) / 20)
    w[:len(clique)] += clique
    return w


def para48(x, sr):
    if sr == SR: return np.asarray(x, float)
    from math import gcd
    g = gcd(SR, sr); return resample_poly(np.asarray(x, float), SR // g, sr // g)


# ---------- tom: WORLD (medido para o Vorag e deixado de fora) e PSOLA (o usado) ----------
def world(x, sr, metodo='dio'):
    """análise WORLD; o tom pelo dio + stonemask (o harvest marcava pausas como sonoras e a ressíntese enchia as pausas: +4 dB de piso)"""
    import pyworld as pw
    x64 = np.ascontiguousarray(x, dtype=np.float64)
    if metodo == 'dio':
        f0, t = pw.dio(x64, sr, f0_floor=60.0, f0_ceil=600.0, frame_period=5.0); f0 = pw.stonemask(x64, f0, t, sr)
    else:
        f0, t = pw.harvest(x64, sr, f0_floor=60.0, f0_ceil=600.0, frame_period=5.0)
    sp = pw.cheaptrick(x64, f0, t, sr); ap = pw.d4c(x64, f0, t, sr); return f0, sp, ap


def tom_psola(x, sr, semitons):
    """tom por PSOLA no domínio do tempo (Praat, via parselmouth: Manipulation, pitch tier multiplicado, ressíntese por sobreposição)"""
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(np.asarray(x, float), sampling_frequency=sr); man = call(snd, 'To Manipulation', 0.01, 60, 400); pt = call(man, 'Extract pitch tier')
    call(pt, 'Multiply frequencies', snd.xmin, snd.xmax, 2 ** (semitons / 12)); call([pt, man], 'Replace pitch tier'); y = call(man, 'Get resynthesis (overlap-add)').values[0]
    return np.pad(y, (0, max(0, len(x) - len(y))))[:len(x)]


def world_sintese(f0, sp, ap, sr, semitons, n):
    import pyworld as pw
    y = pw.synthesize(np.ascontiguousarray(f0 * 2 ** (semitons / 12)), sp, ap, sr, frame_period=5.0)
    return np.pad(y, (0, max(0, n - len(y))))[:n]


# ---------- as cinco Raças: (sinal a 48 kHz, onde a fala começa em s) ----------
def vehnar(x24, sr24):
    x = para48(x24, sr24)
    y = sosfilt(butter(4, [250, 4000], btype='bandpass', fs=SR, output='sos'), x)   # faixa de rádio, um pouco mais aberta que a v1 (320 a 3.300 Hz)
    y = eq(y, ('pico', 1800, 1.0, 3.0))                                              # presença do rádio (+3 dB; v1 +5 dB)
    y = satura(y, 1.3)                                                               # saturação bem leve (v1: 3,2)
    pre, pos = 0.14, 0.22; n0 = int(pre * SR); out = np.zeros(n0 + len(y) + int(pos * SR)); out[n0:n0 + len(y)] = y
    a = ruido_curto(0.05, -44, semente=7); out[int(0.02 * SR):int(0.02 * SR) + len(a)] += a          # antes: termina 70 ms antes da fala
    d = ruido_curto(0.045, -46, semente=8); i = n0 + len(y) + int(0.06 * SR); out[i:i + len(d)] += d  # depois: começa 60 ms depois da fala
    return out, pre


def erevane(x24, sr24):
    x = para48(x24, sr24); a = eq(x, ('graves', 180, 0.7071, -4), ('agudos', 5500, 0.7071, 6), ('pico', 11000, 0.7, 4))
    a = np.concatenate([a, np.zeros(int(2.0 * SR))])
    ir = sala(2.0, 2.4, semente=11); hp = eq(a, ('passa-alta', 500, 0.7071))
    rv = (fftconvolve(hp, ir[0])[:len(a)] + fftconvolve(hp, ir[1])[:len(a)]) / 2
    return 0.82 * a + eco(a, 0.165, 0.36, 4200, 0.36) + 0.34 * rv, 0.0


def tessara(x24, sr24):
    x = para48(x24, sr24); a = satura(eq(x, ('graves', 240, 0.7071, 5), ('pico', 950, 0.8, 2.5), ('agudos', 4800, 0.7071, -6)), 1.8, 0.12)
    a = np.concatenate([a, np.zeros(int(0.8 * SR))]); ir = sala(0.7, 4.0, corte=2800, semente=23)
    rv = (fftconvolve(a, ir[0])[:len(a)] + fftconvolve(a, ir[1])[:len(a)]) / 2
    return 0.36 * a + 0.17 * atraso_var(a, 0.02, 0.0025, 0.9) + 0.08 * rv, 0.0


def quorith(x24, sr24):
    x = para48(x24, sr24); a = np.concatenate([eq(x, ('pico', 2800, 1.2, 3)), np.zeros(int(2.4 * SR))])
    L = 0.65 * a; R = 0.65 * a
    for d, f, prof, p in [(0.017, 0.31, 0.0022, -0.85), (0.024, 0.47, 0.0030, -0.35), (0.031, 0.59, 0.0026, 0.35), (0.040, 0.73, 0.0034, 0.85)]:
        v = 0.5 * atraso_var(a, d, prof, f); th = (p + 1) * np.pi / 4; L += np.cos(th) * v; R += np.sin(th) * v
    hp = eq(a, ('passa-alta', 900, 0.7071)); ir = sala(2.4, 2.6, semente=31)
    L += 0.26 * fftconvolve(hp, ir[0])[:len(a)]; R += 0.26 * fftconvolve(hp, ir[1])[:len(a)]
    return np.stack([L, R], 1), 0.0


def portao(y, chave, abaixo_db=40.0, razao=2.0, sr=SR):
    """expansor para baixo guiado pela voz seca (mesmo tempo): onde a seca está a mais de abaixo_db do seu quadro mais forte, a saída cai
    junto (razão 2:1), com 25 ms de folga; segura nas pausas o que a ressíntese do tom deixar, sem tocar na fala"""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    n = int(sr * 0.005); k = len(chave) // n; e = 10 * np.log10((chave[:k * n].reshape(k, n) ** 2).mean(1) + 1e-14); lim = e.max() - abaixo_db
    red = uniform_filter1d(maximum_filter1d(np.where(e < lim, (e - lim) * (razao - 1), 0.0), 5), 5); g = np.repeat(10 ** (red / 20), n)
    g = np.concatenate([g, np.full(max(0, len(y) - len(g)), g[-1] if len(g) else 1.0)])[:len(y)]
    return y * g


def vorag(x24, sr24, semitons=-3.0):
    """3 semitons abaixo por PSOLA (Praat): mesma velocidade, formantes e consoantes. Comparado nas 12 falas da faixa contra o WORLD
    (harvest; dio + stonemask; com e sem a camada uma oitava abaixo): erro de transcrição 2,0% (seca 1,8%; WORLD 4,3 a 6,3%, "Base" virava
    "Basis") e piso nas pausas +1,8 dB sobre a seca (WORLD com harvest +4,6 dB; a cadeia ao vivo da v1, +13 a +22 dB)"""
    v = para48(tom_psola(x24, sr24, semitons), sr24)
    a = eq(v, ('passa-alta', 70, 0.7071), ('graves', 150, 0.7071, 3), ('pico', 2500, 1.0, 2), ('passa-baixa', 7000, 0.7071))  # sem ronco abaixo de 70 Hz; graves +3 dB (v1 +7)
    a = 0.75 * a + 0.25 * satura(a, 2.0)                                               # aspereza: saturação leve em paralelo, só harmônicos (v1: 4,5 em série + 38 Hz)
    return portao(a, para48(x24, sr24)), 0.0


def genero_praat(x, sr, semitons, formantes):
    """tom e formantes juntos pelo "Change gender" do Praat (reamostra para mover os formantes e corrige o tom por PSOLA): a mediana do
    tom vai para semitons abaixo e os formantes são multiplicados por formantes (< 1: trato vocal maior, voz de corpo grande)"""
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(np.asarray(x, float), sampling_frequency=sr); med = call(snd.to_pitch(pitch_floor=60.0, pitch_ceiling=400.0), 'Get quantile', 0, 0, 0.5, 'Hertz')
    y = call(snd, 'Change gender', 60, 400, formantes, med * 2 ** (semitons / 12), 1.0, 1.0).values[0]
    return np.pad(y, (0, max(0, len(x) - len(y))))[:len(x)]


def _vorag_final(v48, x24, sr24, graves, sat_mix, sat_k):
    a = eq(v48, ('passa-alta', 70, 0.7071), ('graves', 150, 0.7071, graves), ('pico', 2500, 1.0, 2), ('passa-baixa', 7000, 0.7071))
    a = (1 - sat_mix) * a + sat_mix * satura(a, sat_k)
    return portao(a, para48(x24, sr24)), 0.0


# 3ª rodada (29/10/2026): o dono achou o Vorag da 2ª rodada "muito normal". Três variantes mais graves, todas pelo mesmo caminho limpo
# (PSOLA, sem vocoder, sem modulação), para ele escolher de ouvido:
def vorag_a(x24, sr24):  # A: −4 semitons, graves +5 dB, a mesma saturação leve
    return _vorag_final(para48(tom_psola(x24, sr24, -4.0), sr24), x24, sr24, 5.0, 0.25, 2.0)


def vorag_b(x24, sr24):  # B: −5 semitons, graves +6 dB e mais aspereza em paralelo
    return _vorag_final(para48(tom_psola(x24, sr24, -5.0), sr24), x24, sr24, 6.0, 0.4, 2.8)


def vorag_c(x24, sr24):  # C: −5 semitons e formantes 12% abaixo ("Change gender" do Praat): corpo de voz grande
    return _vorag_final(para48(genero_praat(x24, sr24, -5.0, 0.88), sr24), x24, sr24, 4.0, 0.3, 2.2)


def erevane_loc(x24, sr24):
    """5.0c.1: o eco mais leve do locutor da Erevane (aprovado em 29/10/2026): realimentação 0,36 → 0,25 e sala 0,34 → 0,2. O eco de 165 ms da v1
    confundia os avisos curtos ("Base sob ataque" virava "Basis Sobataki"); o líder fica com o eco da v1. Vale também para as unidades da Erevane,
    que são falas curtas como os avisos.
    5.0c.2 (pedido do dono: as vozes da Erevane soavam femininas): sem afinar a voz masculina. Graves −4 → 0 dB, agudos em 5,5 kHz +6 → +3 dB e
    ar em 11 kHz +4 → +2 dB; o eco leve e a sala ficam. O centroide espectral das unidades (Alex) caiu de 1.271 para 796 Hz em pt-BR (Alex seco
    777 Hz; unidades do Vehnar 708 e do Quorith 756 Hz): ainda um pouco de ar acima da voz seca, a identidade fria de vidro."""
    x = para48(x24, sr24); a = eq(x, ('graves', 180, 0.7071, 0), ('agudos', 5500, 0.7071, 3), ('pico', 11000, 0.7, 2))
    a = np.concatenate([a, np.zeros(int(2.0 * SR))])
    ir = sala(2.0, 2.4, semente=11); hp = eq(a, ('passa-alta', 500, 0.7071))
    rv = (fftconvolve(hp, ir[0])[:len(a)] + fftconvolve(hp, ir[1])[:len(a)]) / 2
    return 0.82 * a + eco(a, 0.165, 0.25, 4200, 0.36) + 0.2 * rv, 0.0


ASSAR = {'vehnar': vehnar, 'erevane': erevane, 'erevane-loc': erevane_loc, 'tessara': tessara, 'quorith': quorith, 'vorag': vorag, 'vorag-a': vorag_a, 'vorag-b': vorag_b, 'vorag-c': vorag_c}
VORAG_VARIANTES = {'vorag-a': 'A: −4 semitons, graves +5 dB', 'vorag-b': 'B: −5 semitons, graves +6 dB e mais aspereza', 'vorag-c': 'C: −5 semitons e formantes 12% abaixo (corpo grande), graves +4 dB'}

# ---------- 5.0c.1: o elenco das falas do jogo, por idioma ----------
# Líder e locutor: o elenco aprovado (ELENCO em pt-BR; em espanhol as mesmas vozes ef_/em_ com os mesmos pesos; em inglês as vozes da 3ª rodada,
# tools/vozes/idiomas.json). Unidades: a voz-base (Alex) com o caráter da Raça, um pouco diferente por classe (velocidade e um pouco do Santa nos
# veículos e no suporte), sempre dentro das três vozes aprovadas. Em inglês o papel do Alex é o am_michael e o do Santa, o bm_george (como no elenco).
VOZ_ES = {'pf_dora': 'ef_dora', 'pm_alex': 'em_alex', 'pm_santa': 'em_santa'}
VOZ_EN = {'pm_alex': 'am_michael', 'pm_santa': 'bm_george', 'pf_dora': 'af_bella'}
UNIDADES = {'civil': ({'pm_alex': 1.0}, 1.0), 'infantaria': ({'pm_alex': 1.0}, 1.05), 'veiculo': ({'pm_alex': 0.6, 'pm_santa': 0.4}, 0.95),
            'drone': ({'pm_alex': 1.0}, 1.1), 'suporte': ({'pm_alex': 0.8, 'pm_santa': 0.2}, 1.0)}
ASSADO_JOGO = {'vehnar': 'vehnar', 'erevane': 'erevane', 'tessara': 'tessara', 'quorith': 'quorith', 'vorag': 'vorag-c'}  # Vorag na variante C (29/10)
VERSAO_ASSADO = {'erevane-loc': '5.0c.2'}  # muda a assinatura das falas: a etapa jogo refaz as que usam o caráter mudado


def assado_do_papel(raca, quem):
    """o caráter assado de cada fala: o da Raça; a Erevane com o eco mais leve fora da voz do líder (locutor, eliminações e unidades)"""
    return 'erevane-loc' if raca == 'erevane' and quem != 'lider' else ASSADO_JOGO[raca]


def voz_do_papel(raca, quem, idioma, classe=None, en=None):
    """(pesos do Kokoro, velocidade, g2p) de quem fala: quem = 'lider' | 'locutor' | 'unidade'; en = o bloco kokoro.en do idiomas.json"""
    if quem == 'unidade':
        pesos, vel = UNIDADES[classe]
    else:
        e = ELENCO[raca]; pesos, vel = (e['lider_pesos'], e['lider_vel']) if quem == 'lider' else (e['locutor_pesos'], e['locutor_vel'])
    if idioma == 'pt-BR': return dict(pesos), vel, 'p'
    if idioma == 'es': return {VOZ_ES[v]: w for v, w in pesos.items()}, vel, 'e'
    if quem != 'unidade':
        k = en[raca]['lider' if quem == 'lider' else 'locutor']; return dict(k['pesos']), k['vel'], k['g2p']
    p = {}
    for v, w in pesos.items(): p[VOZ_EN[v]] = p.get(VOZ_EN[v], 0) + w
    am = sum(w for v, w in p.items() if v[0] == 'a'); return p, vel, ('a' if am >= 0.5 else 'b')


def assar(raca, x24, sr24):
    y, pre = ASSAR[raca](np.asarray(x24, float), sr24)
    return aparar_cauda(y), pre


def aparar_cauda(y, lim_db=-62.0):
    """corta a cauda (eco, sala) quando ela cai abaixo de lim_db dBFS, com 60 ms de folga e rampa de 20 ms"""
    m = np.abs(y).max(1) if y.ndim == 2 else np.abs(y); acima = np.where(m > 10 ** (lim_db / 20))[0]
    if not len(acima): return y
    fim = min(len(m), acima[-1] + int(0.06 * SR)); y = y[:fim].copy(); r = int(0.02 * SR)
    if fim > r:
        w = np.linspace(1, 0, r)
        if y.ndim == 2: y[-r:] *= w[:, None]
        else: y[-r:] *= w
    return y


# ---------- medidas ----------
def _quadros(m, n):
    k = len(m) // n; return (m[:k * n].reshape(k, n) ** 2).mean(1) + 1e-14


def regiao_fala(m, sr, lim=40.0):
    """início e fim da fala (s): do primeiro ao último quadro de 20 ms a menos de lim dB do quadro mais forte"""
    n = int(sr * 0.02); p = _quadros(m, n); on = np.where(10 * np.log10(p) > 10 * np.log10(p.max()) - lim)[0]
    return on[0] * n / sr, (on[-1] + 1) * n / sr


def _hnr(seg, sr):
    """razão harmônico/ruído (dB, mediana dos quadros com voz): autocorrelação normalizada pela da janela (Boersma, 1993)"""
    n = int(sr * 0.04); h = int(sr * 0.01); w = np.hanning(n); W = np.fft.rfft(w, 2 * n); rw = np.fft.irfft(np.abs(W) ** 2)[:n]; rw /= rw[0]
    lo, hi = int(sr / 500), int(sr / 60); es = [((seg[j:j + n] - seg[j:j + n].mean()) ** 2).mean() for j in range(0, len(seg) - n, h)]
    if not es: return None
    lim = max(es) * 10 ** (-25 / 10); vals = []
    for j, e in zip(range(0, len(seg) - n, h), es):
        if e < lim: continue
        f = seg[j:j + n] - seg[j:j + n].mean(); F = np.fft.rfft(f * w, 2 * n); r = np.fft.irfft(np.abs(F) ** 2)[:n]
        r = r / (r[0] + 1e-18) / np.maximum(rw, 1e-3); rr = r[lo:hi]; rm = float(rr.max())
        if rm < 0.3: continue
        rm = min(rm, 0.999999); vals.append(10 * np.log10(rm / (1 - rm)))
    return round(float(np.median(vals)), 1) if vals else None


def _aspereza(seg, sr):
    """índice de aspereza (dB): energia das flutuações rápidas do envelope (20 a 75 Hz, onde mora a aspereza; abaixo do tom destas vozes)
    sobre as lentas, das sílabas (2 a 20 Hz), na faixa de 500 a 4.000 Hz"""
    b = sosfilt(butter(4, [500, 4000], btype='bandpass', fs=sr, output='sos'), seg); env = np.abs(hilbert(b)); env = resample_poly(env, 1, sr // 1000); env = env - env.mean()
    if len(env) < 64: return None
    f, P = welch(env, fs=1000, nperseg=min(len(env), 512)); lo = P[(f >= 2) & (f < 20)].sum(); hi = P[(f >= 20) & (f < 75)].sum()
    return round(float(10 * np.log10(hi / (lo + 1e-18) + 1e-18)), 1)


def _f0(seg, sr):
    n = int(sr * 0.04); h = n // 2; lo, hi = int(sr / 400), int(sr / 60); ref = float(np.abs(seg).max()) + 1e-9; vals = []
    for i in range(0, len(seg) - n, h):
        f = seg[i:i + n] - seg[i:i + n].mean()
        if np.sqrt((f ** 2).mean()) < ref * 0.08: continue
        F = np.fft.rfft(f, 2 * n); ac = np.fft.irfft(np.abs(F) ** 2)[:n]; ac = ac / (ac[0] + 1e-18); k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.5: vals.append(sr / k)
    return round(float(np.median(vals)), 1) if vals else None


def pausas_da_seca(m, sr, regiao):
    """os 10% de quadros de 20 ms mais baixos da voz seca dentro da fala (índices): as pausas entre as palavras"""
    n = int(sr * 0.02); p = _quadros(m, n); a, b = int(regiao[0] * sr) // n, min(len(p) - 1, int(regiao[1] * sr) // n)
    q = max(1, int(round(0.1 * (b - a + 1)))); return (a + np.argsort(p[a:b + 1])[:q]).tolist()


def medir(y, sr, regiao, pausas=None, desloc=0.0):
    """medidas de um áudio (mono ou estéreo) na região da fala (s): nível ativo, pico, piso (média dos 10% de quadros de 20 ms mais baixos
    dentro da fala, também relativo ao nível ativo), piso nas pausas da voz seca (os mesmos quadros onde a seca está calada, deslocados
    pelo início da fala), HNR, aspereza, tom médio, estéreo e cauda depois da fala"""
    y = np.asarray(y, float); m = y.mean(1) if y.ndim == 2 else y; n = int(sr * 0.02); p = _quadros(m, n)
    a, b = int(regiao[0] * sr) // n, min(len(p) - 1, int(regiao[1] * sr) // n); dentro = p[a:b + 1]
    q = max(1, int(round(0.1 * len(dentro)))); piso = 10 * np.log10(np.sort(dentro)[:q].mean())
    at = p[p > p.max() * 10 ** (-30 / 10)]; nivel = 10 * np.log10(at.mean()); seg = m[a * n:(b + 1) * n]
    fim = np.where(10 * np.log10(p) > -60)[0]; cauda = max(0.0, (fim[-1] - b) * 0.02) if len(fim) else 0.0
    r = dict(nivel_db=round(nivel, 1), pico_db=round(20 * np.log10(np.abs(y).max() + 1e-12), 1), piso_db=round(piso, 1), piso_rel_db=round(piso - nivel, 1),
             hnr_db=_hnr(seg, sr), aspereza_db=_aspereza(seg, sr), f0_hz=_f0(seg, sr), cauda_s=round(cauda, 2), dur_s=round(len(m) / sr, 2))
    if pausas is not None:
        idx = np.asarray(pausas, int) + int(round(desloc / 0.02)); idx = idx[(idx >= 0) & (idx < len(p))]
        if len(idx): r['piso_pausas_rel_db'] = round(float(10 * np.log10(p[idx].mean()) - nivel), 1)
    if y.ndim == 2:
        side = (y[:, 0] - y[:, 1]) / 2; r['estereo_db'] = round(10 * np.log10((side ** 2).mean() / ((m ** 2).mean() + 1e-18) + 1e-18), 1)
    return r
