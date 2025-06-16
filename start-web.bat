@echo off
echo === Network Monitor - Versao Web Simples ===
echo.

echo [1/2] Iniciando backend Python...
cd backend
start "Network Monitor Backend" cmd /c "python main.py"

echo Aguardando backend inicializar...
timeout /t 3 /nobreak > nul

echo.
echo [2/2] Abrindo interface web...
cd ..\frontend-simple

echo Abrindo no navegador padrao...
start index.html

echo.
echo ✓ Network Monitor Web iniciado!
echo.
echo Interface: frontend-simple\index.html
echo Backend: http://localhost:8000
echo.
echo Para parar o backend, feche a janela do terminal.
echo.
pause

