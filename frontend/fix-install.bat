@echo off
echo === Network Monitor - Correcao de Instalacao ===
echo.

echo [1/6] Verificando permissoes...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✓ Executando como administrador
) else (
    echo ✗ ERRO: Execute como administrador!
    echo Clique com botao direito no PowerShell e selecione "Executar como administrador"
    pause
    exit /b 1
)

echo.
echo [2/6] Limpando cache do npm...
npm cache clean --force

echo.
echo [3/6] Removendo arquivos antigos...
if exist node_modules (
    echo Removendo node_modules...
    rmdir /s /q node_modules
)
if exist package-lock.json (
    echo Removendo package-lock.json...
    del package-lock.json
)

echo.
echo [4/6] Configurando npm...
npm config set timeout 120000
npm config delete proxy 2>nul
npm config delete https-proxy 2>nul
npm config set registry https://registry.npmjs.org/

echo.
echo [5/6] Instalando dependencias (isso pode demorar)...
npm install --legacy-peer-deps --no-optional --verbose

echo.
echo [6/6] Verificando instalacao...
if exist node_modules (
    echo ✓ Instalacao concluida com sucesso!
    echo.
    echo Para executar o aplicativo:
    echo 1. Volte para a pasta raiz: cd ..
    echo 2. Execute: start.bat
) else (
    echo ✗ Instalacao falhou!
    echo Tente executar manualmente:
    echo npm install --legacy-peer-deps --force
)

echo.
pause

