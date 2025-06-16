#!/bin/bash

echo "=== Network Monitor - Versão Web Simples ==="
echo

echo "[1/2] Iniciando backend Python..."
cd backend
python3.11 main.py &
BACKEND_PID=$!

echo "Aguardando backend inicializar..."
sleep 3

echo
echo "[2/2] Abrindo interface web..."
cd ../frontend-simple

# Tentar abrir no navegador padrão
if command -v xdg-open > /dev/null; then
    xdg-open index.html
elif command -v open > /dev/null; then
    open index.html
else
    echo "Abra manualmente: frontend-simple/index.html"
fi

echo
echo "✓ Network Monitor Web iniciado!"
echo
echo "Interface: frontend-simple/index.html"
echo "Backend: http://localhost:8000"
echo
echo "Pressione Ctrl+C para parar"

# Aguardar sinal de interrupção
trap "echo 'Parando backend...'; kill $BACKEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait

