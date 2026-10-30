#!/usr/bin/env bash
# 5.0a.2 (3ª rodada): ferramentas da avaliação de idiomas (inglês e espanhol), tudo em .tools/vozes/ (ignorada pelo git).
# - vozes do Kokoro em inglês e espanhol (hexgrad/Kokoro-82M/voices, Apache-2.0) e o modelo do spaCy que o G2P inglês do misaki usa;
# - Chatterbox Multilingual (Resemble AI, MIT; marca d'água PerTh em toda saída) num venv separado, porque prende torch 2.6 e
#   transformers 5.2 (o venv do Kokoro usa outro torch). O gradio da demonstração fica de fora (--no-deps e a lista abaixo).
# Uso: bash tools/vozes/preparar-idiomas.sh   (depois de tools/vozes/preparar.sh)
# 5.0c.1: o dono ficou com o Kokoro nos três idiomas (29/10/2026) e o Chatterbox saiu; ele só é instalado com --chatterbox (4,8 GB).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; T="$ROOT/.tools/vozes"
mkdir -p "$T/cache/hf" "$T/cache/xdg" "$T/tmp"
export HF_HOME="$T/cache/hf" XDG_CACHE_HOME="$T/cache/xdg" TORCH_HOME="$T/cache/torch" TMPDIR="$T/tmp" PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
HF=https://huggingface.co
get() { if [ ! -s "$2" ]; then curl -sSfL "$1" -o "$2.part" && mv -f "$2.part" "$2"; fi; }
# Kokoro: vozes escolhidas pelo papel no elenco (VOICES.md: af_heart A, af_bella A-, bf_emma B-, am_michael C+, am_fenrir C+, bm_george C; espanhol sem nota)
for v in af_heart af_bella bf_emma am_michael am_fenrir bm_george bm_daniel ef_dora em_alex em_santa; do get "$HF/hexgrad/Kokoro-82M/resolve/main/voices/$v.pt" "$T/modelos/kokoro/voices/$v.pt"; done  # 5.0c.2: bm_daniel, o locutor da Erevane em inglês
"$T/venv/bin/python" -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null || "$T/venv/bin/python" -m spacy download en_core_web_sm -q
if [ "${1:-}" != "--chatterbox" ]; then echo 'vozes en/es do Kokoro e spaCy prontos (Chatterbox não instalado: use --chatterbox)'; exit 0; fi
# Chatterbox Multilingual (chatterbox-tts 0.1.7), CPU
[ -x "$T/venv-cb/bin/python" ] || python3 -m venv "$T/venv-cb"
PY="$T/venv-cb/bin/python"
"$PY" -m pip install -q --upgrade pip wheel "setuptools<81"
"$PY" -m pip install -q torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
"$PY" -m pip install -q --no-deps chatterbox-tts==0.1.7
"$PY" -m pip install -q "numpy<2" librosa==0.11.0 s3tokenizer transformers==5.2.0 diffusers==0.29.0 "resemble-perth>=1.0.0" conformer==0.3.2 safetensors==0.5.3 spacy-pkuseg pykakasi==2.3.0 pyloudnorm omegaconf soundfile huggingface_hub
"$PY" - <<'EOF'
from huggingface_hub import snapshot_download
import chatterbox.mtl_tts as m, inspect, re
src = inspect.getsource(m); pats = sorted(set(re.findall(r'"([\w.\-]+\.(?:pt|safetensors|json))"', src)))
print('arquivos do multilíngue:', pats)
p = snapshot_download(repo_id='ResembleAI/chatterbox', allow_patterns=pats); print('modelo em', p)
EOF
du -sh "$T/venv-cb" "$T/cache/hf" | sed 's/^/ocupa: /'
