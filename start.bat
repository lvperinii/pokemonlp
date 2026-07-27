@echo off
REM Inicia o app localmente (Windows). Duplo-clique neste arquivo.
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Node.js nao encontrado - usando Python. Abra: http://localhost:8000
  python -m http.server 8000
  goto :eof
)

echo Instale Node.js ^(https://nodejs.org^) ou Python para rodar o app.
pause
