@echo off
REM Script para iniciar o Network Monitor no Windows

echo === Network Monitor - Iniciando ===

REM Verifica se está no diretório correto
if not exist "backend" (
    echo Erro: Execute este script no diretório raiz do projeto network-monitor
    pause
    exit /b 1
)

if not exist "frontend" (
    echo Erro: Execute este script no diretório raiz do projeto network-monitor
    pause
    exit /b 1
)

REM Inicia o backend Python em uma nova janela
echo Iniciando backend Python...
start "Network Monitor Backend" /min cmd /c "cd backend && python main.py"

REM Aguarda o backend inicializar
echo Aguardando backend inicializar...
timeout /t 5 /nobreak > nul

REM Inicia o frontend Electron
echo Iniciando frontend Electron...
cd frontend
set NODE_ENV=development
npm run electron-dev

echo Network Monitor finalizado.
pause

