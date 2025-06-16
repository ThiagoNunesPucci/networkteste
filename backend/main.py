import asyncio
import json
import os
import time
from datetime import datetime
from typing import Dict, List, Optional
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Importa módulos locais
from network_monitor import NetworkMonitor
from report_generator import ReportGenerator

# Variáveis globais
network_monitor = None
report_generator = None
websocket_connections: List[WebSocket] = []

# Credenciais de autenticação (em produção, usar variáveis de ambiente)
VALID_CREDENTIALS = {
    "admin": "networkteste"
}

def verify_credentials(username: str, password: str) -> bool:
    """Verifica se as credenciais são válidas"""
    return VALID_CREDENTIALS.get(username) == password

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação"""
    global network_monitor, report_generator
    
    try:
        print("🚀 Iniciando servidor Network Monitor...")
        
        # Inicializa gerador de relatórios
        report_generator = ReportGenerator()
        print("✅ Gerador de relatórios inicializado")
        
        # Inicializa monitor de rede
        network_monitor = NetworkMonitor()
        
        # Registra callback para WebSocket
        def websocket_callback(data):
            if websocket_connections:
                asyncio.create_task(broadcast_to_websockets(data))
        
        network_monitor.register_callback(websocket_callback)
        print("✅ Callback WebSocket registrado")
        
        # Inicia monitoramento
        network_monitor.start_monitoring()
        print("=== INICIANDO MONITORAMENTO ===")
        
        yield
        
    except Exception as e:
        print(f"❌ Erro na inicialização: {e}")
        raise
    finally:
        # Cleanup
        if network_monitor:
            network_monitor.stop_monitoring()
        print("🛑 Servidor finalizado")

# Cria aplicação FastAPI
app = FastAPI(
    title="Network Monitor API",
    description="API para monitoramento de rede em tempo real",
    version="1.2.0",
    lifespan=lifespan
)

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def broadcast_to_websockets(data):
    """Envia dados para todos os WebSockets conectados"""
    if not websocket_connections:
        return
    
    message = json.dumps(data)
    disconnected = []
    
    for websocket in websocket_connections:
        try:
            await websocket.send_text(message)
        except Exception as e:
            print(f"❌ Erro ao enviar para WebSocket: {e}")
            disconnected.append(websocket)
    
    # Remove conexões desconectadas
    for ws in disconnected:
        if ws in websocket_connections:
            websocket_connections.remove(ws)

# === ROTAS DE AUTENTICAÇÃO ===

@app.post("/api/auth/login")
async def login(request: Request):
    """Endpoint de login"""
    try:
        # Pega dados do corpo da requisição
        body = await request.json()
        username = body.get("username", "").strip()
        password = body.get("password", "")
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Usuário e senha são obrigatórios")
        
        if verify_credentials(username, password):
            return {
                "success": True,
                "message": "Login realizado com sucesso",
                "user": username
            }
        else:
            raise HTTPException(status_code=401, detail="Credenciais inválidas")
            
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Dados inválidos")
    except Exception as e:
        logger.error(f"Erro no login: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

# === ROTAS DA API ===

@app.get("/api/status")
async def get_status():
    """Retorna status geral do sistema"""
    try:
        if not network_monitor:
            raise HTTPException(status_code=503, detail="Monitor não inicializado")
        
        status_data = {
            "status": "online",
            "timestamp": datetime.now().isoformat(),
            "monitoring_active": network_monitor.is_monitoring,
            "targets": {
                "google_dns": "8.8.8.8",
                "gateway": network_monitor.get_gateway_ip(),
                "custom_targets": network_monitor.get_custom_targets()
            },
            "version": "1.2.0"
        }
        
        return status_data
        
    except Exception as e:
        logger.error(f"Erro ao obter status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/targets")
async def get_targets():
    """Retorna todos os destinos configurados"""
    try:
        if not network_monitor:
            raise HTTPException(status_code=503, detail="Monitor não inicializado")
        
        return {
            "default_targets": {
                "google_dns": "8.8.8.8",
                "gateway": network_monitor.get_gateway_ip()
            },
            "custom_targets": network_monitor.get_custom_targets()
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter destinos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/targets/custom")
async def add_custom_target(request: Request):
    """Adiciona um destino personalizado"""
    try:
        if not network_monitor:
            raise HTTPException(status_code=503, detail="Monitor não inicializado")
        
        data = await request.json()
        ip = data.get("ip", "").strip()
        name = data.get("name", "").strip()
        enabled = data.get("enabled", True)
        
        if not ip:
            raise HTTPException(status_code=400, detail="IP é obrigatório")
        
        if not name:
            name = f"Destino {ip}"
        
        # Adiciona destino
        success = network_monitor.add_custom_target(ip, name, enabled)
        
        if success:
            return {
                "success": True,
                "message": "Destino adicionado com sucesso",
                "target": {"ip": ip, "name": name, "enabled": enabled}
            }
        else:
            raise HTTPException(status_code=400, detail="Erro ao adicionar destino")
            
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Dados JSON inválidos")
    except Exception as e:
        logger.error(f"Erro ao adicionar destino: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/targets/custom/{target_ip}")
async def update_custom_target(target_ip: str, request: Request):
    """Atualiza um destino personalizado"""
    try:
        if not network_monitor:
            raise HTTPException(status_code=503, detail="Monitor não inicializado")
        
        data = await request.json()
        new_ip = data.get("ip", "").strip()
        name = data.get("name", "").strip()
        enabled = data.get("enabled", True)
        
        if not new_ip:
            raise HTTPException(status_code=400, detail="IP é obrigatório")
        
        if not name:
            name = f"Destino {new_ip}"
        
        # Atualiza destino
        success = network_monitor.update_custom_target(target_ip, new_ip, name, enabled)
        
        if success:
            return {
                "success": True,
                "message": "Destino atualizado com sucesso",
                "target": {"ip": new_ip, "name": name, "enabled": enabled}
            }
        else:
            raise HTTPException(status_code=404, detail="Destino não encontrado")
            
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Dados JSON inválidos")
    except Exception as e:
        logger.error(f"Erro ao atualizar destino: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/targets/custom/{target_ip}")
async def remove_custom_target(target_ip: str):
    """Remove um destino personalizado"""
    try:
        if not network_monitor:
            raise HTTPException(status_code=503, detail="Monitor não inicializado")
        
        success = network_monitor.remove_custom_target(target_ip)
        
        if success:
            return {
                "success": True,
                "message": "Destino removido com sucesso"
            }
        else:
            raise HTTPException(status_code=404, detail="Destino não encontrado")
            
    except Exception as e:
        logger.error(f"Erro ao remover destino: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports")
async def get_reports():
    """Retorna relatórios disponíveis"""
    try:
        if not report_generator:
            raise HTTPException(status_code=503, detail="Gerador de relatórios não inicializado")
        
        # Obtém falhas ativas
        active_failures = {}
        if network_monitor:
            active_failures = network_monitor.get_active_failures()
        
        # Obtém lista de relatórios
        reports_list = report_generator.list_reports()
        
        # Calcula resumo
        summary = report_generator.get_summary()
        
        return {
            "active_failures": active_failures,
            "reports": reports_list,
            "summary": summary
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter relatórios: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reports/generate")
async def generate_report():
    """Gera um relatório manual"""
    try:
        if not report_generator:
            raise HTTPException(status_code=503, detail="Gerador de relatórios não inicializado")
        
        filename = report_generator.generate_manual_report()
        
        return {
            "success": True,
            "message": "Relatório gerado com sucesso",
            "filename": filename
        }
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/{filename}")
async def get_report_content(filename: str):
    """Retorna conteúdo de um relatório específico"""
    try:
        if not report_generator:
            raise HTTPException(status_code=503, detail="Gerador de relatórios não inicializado")
        
        content = report_generator.get_report_content(filename)
        
        if content:
            return content
        else:
            raise HTTPException(status_code=404, detail="Relatório não encontrado")
            
    except Exception as e:
        logger.error(f"Erro ao obter conteúdo do relatório: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === WEBSOCKET ===

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Endpoint WebSocket para comunicação em tempo real"""
    await websocket.accept()
    websocket_connections.append(websocket)
    
    print(f"✅ WebSocket conectado. Total: {len(websocket_connections)}")
    
    try:
        # Envia destinos iniciais
        if network_monitor:
            initial_data = {
                "type": "initial_targets",
                "data": {
                    "custom_targets": network_monitor.get_custom_targets()
                }
            }
            await websocket.send_text(json.dumps(initial_data))
        
        # Mantém conexão ativa
        while True:
            try:
                # Recebe mensagens do cliente (ping/pong)
                message = await websocket.receive_text()
                data = json.loads(message)
                
                if data.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"❌ Erro no WebSocket: {e}")
                break
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"❌ Erro na conexão WebSocket: {e}")
    finally:
        if websocket in websocket_connections:
            websocket_connections.remove(websocket)
        print(f"❌ WebSocket desconectado. Total: {len(websocket_connections)}")

# === ROTAS ESTÁTICAS ===

@app.get("/login")
async def login_page():
    """Página de login"""
    try:
        login_path = os.path.join(os.path.dirname(__file__), "..", "frontend-simple", "login.html")
        if os.path.exists(login_path):
            return FileResponse(login_path)
        else:
            return HTMLResponse("""
            <!DOCTYPE html>
            <html>
            <head><title>Login - Network Monitor</title></head>
            <body>
                <h1>Network Monitor - Login</h1>
                <form method="post" action="/api/auth/login">
                    <input type="text" name="username" placeholder="Usuário" required>
                    <input type="password" name="password" placeholder="Senha" required>
                    <button type="submit">Entrar</button>
                </form>
            </body>
            </html>
            """)
    except Exception as e:
        logger.error(f"Erro ao servir página de login: {e}")
        raise HTTPException(status_code=500, detail="Erro interno")

@app.get("/")
async def root():
    """Página principal"""
    try:
        # Verifica se frontend-simple existe
        frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend-simple")
        index_path = os.path.join(frontend_path, "index.html")
        
        if os.path.exists(index_path):
            return FileResponse(index_path)
        else:
            # Fallback para interface básica
            return HTMLResponse("""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Network Monitor</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #1a1a1a; color: white; }
                    .container { max-width: 800px; margin: 0 auto; }
                    .card { background: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px; }
                    .status { padding: 5px 10px; border-radius: 4px; }
                    .online { background: #00d4aa; color: white; }
                    .offline { background: #ff6b6b; color: white; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🌐 Network Monitor</h1>
                    <div class="card">
                        <h2>Status do Sistema</h2>
                        <p>✅ Backend funcionando</p>
                        <p>📡 API disponível em: <a href="/api/status">/api/status</a></p>
                        <p>🔌 WebSocket em: ws://localhost:8000/ws</p>
                    </div>
                    <div class="card">
                        <h2>Acesso</h2>
                        <p>Para acessar a interface completa, certifique-se de que a pasta 'frontend-simple' existe.</p>
                        <p>Credenciais: admin / networkteste</p>
                    </div>
                </div>
            </body>
            </html>
            """)
    except Exception as e:
        logger.error(f"Erro ao servir página principal: {e}")
        raise HTTPException(status_code=500, detail="Erro interno")

# Monta arquivos estáticos se a pasta existir
try:
    frontend_simple_path = os.path.join(os.path.dirname(__file__), "..", "frontend-simple")
    if os.path.exists(frontend_simple_path):
        app.mount("/static", StaticFiles(directory=frontend_simple_path), name="static")
        print(f"✅ Arquivos estáticos montados: {frontend_simple_path}")
    else:
        print(f"⚠️ Pasta frontend-simple não encontrada: {frontend_simple_path}")
except Exception as e:
    print(f"❌ Erro ao montar arquivos estáticos: {e}")

if __name__ == "__main__":
    print("🚀 Iniciando Network Monitor Backend...")
    print("📡 API disponível em: http://localhost:8000")
    print("🌐 Interface web em: http://localhost:8000")
    print("🔌 WebSocket em: ws://localhost:8000/ws")
    print("🔐 Login: admin / networkteste")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

