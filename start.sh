#!/bin/bash

# Script para iniciar o Network Monitor completo
# Este script inicia o backend Python e o frontend Electron

echo "=== Network Monitor - Iniciando ==="

# Verifica se está no diretório correto
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "Erro: Execute este script no diretório raiz do projeto network-monitor"
    exit 1
fi

# Função para cleanup ao sair
cleanup() {
    echo "Parando serviços..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Configura trap para cleanup
trap cleanup SIGINT SIGTERM

# Inicia o backend Python
echo "Iniciando backend Python..."
cd backend
python3.11 main.py &
BACKEND_PID=$!
cd ..

# Aguarda o backend inicializar
echo "Aguardando backend inicializar..."
sleep 3

# Verifica se o backend está rodando
if ! curl -s http://localhost:8000/api/status > /dev/null; then
    echo "Erro: Backend não iniciou corretamente"
    cleanup
fi

echo "Backend iniciado com sucesso!"

# Inicia o frontend Electron
echo "Iniciando frontend Electron..."
cd frontend
NODE_ENV=development npm run electron-dev &
FRONTEND_PID=$!
cd ..

echo "Frontend iniciado com sucesso!"
echo "Network Monitor está rodando!"
echo "Pressione Ctrl+C para parar"

# Aguarda indefinidamente
wait

