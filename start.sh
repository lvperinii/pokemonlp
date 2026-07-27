#!/usr/bin/env sh
# Inicia o app localmente (macOS / Linux). Duplo-clique ou: ./start.sh
cd "$(dirname "$0")" || exit 1

if command -v node >/dev/null 2>&1; then
  exec node server.js
elif command -v python3 >/dev/null 2>&1; then
  echo "Node.js nao encontrado — usando Python. Abra: http://localhost:8000"
  exec python3 -m http.server 8000
elif command -v python >/dev/null 2>&1; then
  echo "Node.js nao encontrado — usando Python. Abra: http://localhost:8000"
  exec python -m http.server 8000
else
  echo "Instale Node.js (https://nodejs.org) ou Python para rodar o app."
  exit 1
fi
