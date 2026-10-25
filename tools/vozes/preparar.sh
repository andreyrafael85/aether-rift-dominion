#!/usr/bin/env bash
# 5.0a.2: prepara a ferramenta das vozes neurais gravadas (avaliação). Tudo fica em .tools/vozes/ (ignorada pelo git):
# venv Python, caches do pip e do Hugging Face, modelos e temporários. Nada é instalado fora da pasta do jogo.
# Uso: bash tools/vozes/preparar.sh            (Kokoro-82M, Piper pt_BR, ffmpeg do imageio-ffmpeg e Whisper para a conferência)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$ROOT/.tools/vozes"
mkdir -p "$T/cache/hf" "$T/cache/xdg" "$T/tmp" "$T/modelos/piper" "$T/modelos/kokoro"
export HF_HOME="$T/cache/hf" XDG_CACHE_HOME="$T/cache/xdg" TORCH_HOME="$T/cache/torch" TMPDIR="$T/tmp" PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
[ -x "$T/venv/bin/python" ] || python3 -m venv "$T/venv"
PY="$T/venv/bin/python"
"$PY" -m pip install -q --upgrade pip wheel "setuptools<81"  # o pyworld ainda importa pkg_resources (saiu do setuptools 81)
# torch só de CPU (o pacote padrão do PyPI traz as bibliotecas CUDA, ~2,5 GB a mais)
"$PY" -m pip install -q torch --index-url https://download.pytorch.org/whl/cpu
# Kokoro-82M (pesos Apache-2.0; G2P misaki + espeak-ng embutido no espeakng-loader), Piper (vozes ONNX), áudio e Whisper (conferência por transcrição)
"$PY" -m pip install -q "kokoro>=0.9.4" soundfile numpy piper-tts imageio-ffmpeg faster-whisper pyworld scipy praat-parselmouth  # caráter das Raças assado (2ª rodada): scipy (BSD), praat-parselmouth (GPL-3.0, PSOLA do Vorag), pyworld (MIT, medido e não usado)
# modelos: Kokoro v1.0 (hexgrad/Kokoro-82M) e as vozes pt_BR do Piper (rhasspy/piper-voices), com o MODEL_CARD de cada uma
HF=https://huggingface.co
get() { if [ ! -s "$2" ]; then curl -sSfL "$1" -o "$2.part" && mv -f "$2.part" "$2"; fi; }
for f in kokoro-v1_0.pth config.json VOICES.md README.md; do get "$HF/hexgrad/Kokoro-82M/resolve/main/$f" "$T/modelos/kokoro/$f"; done
mkdir -p "$T/modelos/kokoro/voices"; for v in pf_dora pm_alex pm_santa; do get "$HF/hexgrad/Kokoro-82M/resolve/main/voices/$v.pt" "$T/modelos/kokoro/voices/$v.pt"; done
for v in faber/medium cadu/medium jeff/medium edresson/low; do n="pt_BR-$(echo "$v" | tr / -)"; d="$T/modelos/piper/$n"; mkdir -p "$d"
  get "$HF/rhasspy/piper-voices/resolve/main/pt/pt_BR/$v/MODEL_CARD" "$d/MODEL_CARD"
  case "$v" in edresson/*) continue;; esac  # base ryan (CC BY-NC-SA 4.0): descartada, só o MODEL_CARD fica para o registro
  get "$HF/rhasspy/piper-voices/resolve/main/pt/pt_BR/$v/$n.onnx" "$d/$n.onnx"; get "$HF/rhasspy/piper-voices/resolve/main/pt/pt_BR/$v/$n.onnx.json" "$d/$n.onnx.json"; done
for v in en/en_US/lessac/medium en/en_US/ryan/low; do n="$(echo "$v" | cut -d/ -f2)-$(echo "$v" | cut -d/ -f3,4 | tr / -)"; mkdir -p "$T/modelos/piper/base-$n"; get "$HF/rhasspy/piper-voices/resolve/main/$v/MODEL_CARD" "$T/modelos/piper/base-$n/MODEL_CARD"; done
"$PY" - <<'EOF'
import imageio_ffmpeg, subprocess, sys
ff = imageio_ffmpeg.get_ffmpeg_exe(); enc = subprocess.run([ff, '-hide_banner', '-encoders'], capture_output=True, text=True).stdout
print('ffmpeg', ff, '| libopus', 'libopus' in enc, '| libmp3lame', 'libmp3lame' in enc)
import kokoro, piper, faster_whisper, torch; print('kokoro', getattr(kokoro, '__version__', '?'), '| torch', torch.__version__, '| piper ok | faster-whisper', faster_whisper.__version__)
EOF
du -sh "$T" | sed 's/^/.tools\/vozes: /'
