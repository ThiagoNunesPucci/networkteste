import asyncio
import time
import logging
import socket
import subprocess
import platform
from typing import Dict, List, Callable, Optional
from datetime import datetime
from threading import Thread, Event
import psutil

try:
    from ping3 import ping
except ImportError:
    ping = None

# Configuração de logging
logger = logging.getLogger(__name__)

class NetworkMonitor:
    def __init__(self):
        self.custom_targets: Dict[str, Dict] = {}
        self.callbacks: List[Callable] = []
        self.ping_history: List[Dict] = []
        self.is_running = False
        self.monitor_thread = None
        self.stop_event = Event()
        
        # Configurações
        self.ping_interval = 5  # segundos
        self.failure_threshold = 3
        self.max_history = 1000
        
        # Cache para gateway
        self._gateway_cache = None
        self._gateway_cache_time = 0
        self._gateway_cache_ttl = 300  # 5 minutos
        
        logger.info("✅ NetworkMonitor inicializado")

    def register_callback(self, callback: Callable):
        """Registra callback para notificações"""
        self.callbacks.append(callback)
        logger.info(f"📞 Callback registrado. Total: {len(self.callbacks)}")

    def get_default_gateway(self) -> Optional[str]:
        """Obtém o gateway padrão da rede"""
        try:
            # Verifica cache
            current_time = time.time()
            if (self._gateway_cache and 
                current_time - self._gateway_cache_time < self._gateway_cache_ttl):
                return self._gateway_cache
            
            # Obtém gateway usando psutil
            gateways = psutil.net_if_addrs()
            stats = psutil.net_if_stats()
            
            # Método alternativo usando route
            if platform.system() == "Windows":
                result = subprocess.run(
                    ["route", "print", "0.0.0.0"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    for line in lines:
                        if '0.0.0.0' in line and 'Gateway' not in line:
                            parts = line.split()
                            if len(parts) >= 3:
                                gateway = parts[2]
                                if self._is_valid_ip(gateway):
                                    self._gateway_cache = gateway
                                    self._gateway_cache_time = current_time
                                    logger.info(f"🏠 Gateway detectado: {gateway}")
                                    return gateway
            else:
                # Linux/Mac
                result = subprocess.run(
                    ["ip", "route", "show", "default"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    lines = result.stdout.strip().split('\n')
                    for line in lines:
                        if 'default via' in line:
                            parts = line.split()
                            if len(parts) >= 3:
                                gateway = parts[2]
                                if self._is_valid_ip(gateway):
                                    self._gateway_cache = gateway
                                    self._gateway_cache_time = current_time
                                    logger.info(f"🏠 Gateway detectado: {gateway}")
                                    return gateway
            
            # Fallback: usar gateway padrão comum
            fallback_gateway = "192.168.1.1"
            logger.warning(f"⚠️ Gateway não detectado, usando fallback: {fallback_gateway}")
            return fallback_gateway
            
        except Exception as e:
            logger.error(f"❌ Erro ao obter gateway: {e}")
            return "192.168.1.1"  # Fallback

    def _is_valid_ip(self, ip: str) -> bool:
        """Valida se é um IP válido"""
        try:
            socket.inet_aton(ip)
            return True
        except socket.error:
            return False

    def ping_target(self, target: str, timeout: int = 3) -> Dict:
        """Executa ping para um destino"""
        try:
            start_time = time.time()
            
            if ping:
                # Usa ping3 se disponível
                result = ping(target, timeout=timeout)
                success = result is not None
                latency = result * 1000 if success else 0
            else:
                # Fallback usando subprocess
                if platform.system() == "Windows":
                    cmd = ["ping", "-n", "1", "-w", str(timeout * 1000), target]
                else:
                    cmd = ["ping", "-c", "1", "-W", str(timeout), target]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=timeout + 1
                )
                
                success = result.returncode == 0
                latency = (time.time() - start_time) * 1000 if success else 0
            
            return {
                "target": target,
                "success": success,
                "latency": round(latency, 2),
                "timestamp": datetime.now().isoformat(),
                "error": None if success else "Timeout ou host inacessível"
            }
            
        except subprocess.TimeoutExpired:
            return {
                "target": target,
                "success": False,
                "latency": 0,
                "timestamp": datetime.now().isoformat(),
                "error": "Timeout"
            }
        except Exception as e:
            logger.error(f"❌ Erro no ping para {target}: {e}")
            return {
                "target": target,
                "success": False,
                "latency": 0,
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            }

    def get_network_speed(self) -> Dict:
        """Obtém velocidade de rede (simulada)"""
        try:
            # Obtém estatísticas de rede
            net_io = psutil.net_io_counters()
            
            # Simula velocidade baseada na atividade de rede
            # Em uma implementação real, você mediria a diferença ao longo do tempo
            download_mbps = min(100, max(0.1, (net_io.bytes_recv % 1000000) / 100000))
            upload_mbps = min(50, max(0.0, (net_io.bytes_sent % 500000) / 100000))
            
            return {
                "download_mbps": round(download_mbps, 1),
                "upload_mbps": round(upload_mbps, 1),
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"❌ Erro ao obter velocidade: {e}")
            return {
                "download_mbps": 0.0,
                "upload_mbps": 0.0,
                "timestamp": datetime.now().isoformat()
            }

    def add_custom_target(self, ip: str, name: str, enabled: bool = True) -> bool:
        """Adiciona um destino personalizado"""
        try:
            logger.info(f"=== ADICIONANDO DESTINO PERSONALIZADO ===")
            logger.info(f"IP: {ip}")
            logger.info(f"Nome: {name}")
            logger.info(f"Enabled: {enabled}")
            
            if ip in self.custom_targets:
                logger.warning(f"⚠️ Destino {ip} já existe")
                return False
            
            # Valida IP/hostname
            if not self._is_valid_target(ip):
                logger.error(f"❌ IP/hostname inválido: {ip}")
                return False
            
            self.custom_targets[ip] = {
                "name": name,
                "enabled": enabled,
                "added_at": datetime.now().isoformat()
            }
            
            logger.info(f"✅ Destino adicionado. Total de destinos personalizados: {len(self.custom_targets)}")
            
            # Notifica callbacks
            self._notify_callbacks({
                "type": "target_added",
                "data": {
                    "ip": ip,
                    "name": name,
                    "enabled": enabled
                }
            })
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao adicionar destino: {e}")
            return False

    def update_custom_target(self, old_ip: str, new_ip: str, name: str, enabled: bool) -> bool:
        """Atualiza um destino personalizado"""
        try:
            logger.info(f"=== ATUALIZANDO DESTINO PERSONALIZADO ===")
            logger.info(f"IP antigo: {old_ip}")
            logger.info(f"IP novo: {new_ip}")
            logger.info(f"Nome: {name}")
            logger.info(f"Enabled: {enabled}")
            
            if old_ip not in self.custom_targets:
                logger.error(f"❌ Destino {old_ip} não encontrado")
                return False
            
            # Valida novo IP/hostname
            if not self._is_valid_target(new_ip):
                logger.error(f"❌ IP/hostname inválido: {new_ip}")
                return False
            
            # Se o IP mudou, remove o antigo e adiciona o novo
            if old_ip != new_ip:
                if new_ip in self.custom_targets:
                    logger.error(f"❌ Novo IP {new_ip} já existe")
                    return False
                
                # Remove antigo
                del self.custom_targets[old_ip]
                
                # Adiciona novo
                self.custom_targets[new_ip] = {
                    "name": name,
                    "enabled": enabled,
                    "updated_at": datetime.now().isoformat()
                }
            else:
                # Apenas atualiza dados
                self.custom_targets[old_ip].update({
                    "name": name,
                    "enabled": enabled,
                    "updated_at": datetime.now().isoformat()
                })
            
            logger.info(f"✅ Destino atualizado com sucesso")
            
            # Notifica callbacks
            self._notify_callbacks({
                "type": "target_updated",
                "data": {
                    "old_ip": old_ip,
                    "ip": new_ip,
                    "name": name,
                    "enabled": enabled
                }
            })
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao atualizar destino: {e}")
            return False

    def remove_custom_target(self, ip: str) -> bool:
        """Remove um destino personalizado"""
        try:
            logger.info(f"=== REMOVENDO DESTINO: {ip} ===")
            
            if ip not in self.custom_targets:
                logger.error(f"❌ Destino {ip} não encontrado")
                return False
            
            del self.custom_targets[ip]
            logger.info(f"✅ Destino {ip} removido. Total restante: {len(self.custom_targets)}")
            
            # Notifica callbacks
            self._notify_callbacks({
                "type": "target_removed",
                "data": {
                    "ip": ip
                }
            })
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao remover destino: {e}")
            return False

    def _is_valid_target(self, target: str) -> bool:
        """Valida se o destino é um IP ou hostname válido"""
        try:
            # Tenta resolver como IP
            socket.inet_aton(target)
            return True
        except socket.error:
            try:
                # Tenta resolver como hostname
                socket.gethostbyname(target)
                return True
            except socket.error:
                return False

    def get_all_targets(self) -> Dict:
        """Retorna todos os destinos (padrão + personalizados)"""
        return {
            "default": {
                "8.8.8.8": {"name": "Google DNS", "enabled": True},
                "gateway": {"name": "Gateway Padrão", "enabled": True}
            },
            "custom": self.custom_targets.copy()
        }

    def _notify_callbacks(self, data: Dict):
        """Notifica todos os callbacks registrados"""
        logger.info(f"📞 Notificando {len(self.callbacks)} callbacks sobre: {data['type']}")
        
        for callback in self.callbacks:
            try:
                callback(data)
            except Exception as e:
                logger.error(f"❌ Erro no callback: {e}")
        
        logger.info("=== NOTIFICAÇÃO CONCLUÍDA ===")

    def start_monitoring(self):
        """Inicia o monitoramento em thread separada"""
        if self.is_running:
            logger.warning("⚠️ Monitoramento já está rodando")
            return
        
        self.is_running = True
        self.stop_event.clear()
        self.monitor_thread = Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        logger.info("🚀 Monitoramento iniciado")

    def stop_monitoring(self):
        """Para o monitoramento"""
        if not self.is_running:
            return
        
        self.is_running = False
        self.stop_event.set()
        
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        
        logger.info("🛑 Monitoramento parado")

    def _monitor_loop(self):
        """Loop principal de monitoramento"""
        logger.info("🔄 Loop de monitoramento iniciado")
        
        while self.is_running and not self.stop_event.is_set():
            try:
                cycle_start = time.time()
                logger.info(f"📊 Ciclo de monitoramento - {datetime.now().strftime('%H:%M:%S')}")
                
                # Testa destinos padrão
                self._test_default_targets()
                
                # Testa destinos personalizados
                self._test_custom_targets()
                
                # Obtém velocidade de rede
                self._test_network_speed()
                
                # Aguarda próximo ciclo
                elapsed = time.time() - cycle_start
                sleep_time = max(0, self.ping_interval - elapsed)
                
                if sleep_time > 0:
                    self.stop_event.wait(sleep_time)
                
            except Exception as e:
                logger.error(f"❌ Erro no loop de monitoramento: {e}")
                self.stop_event.wait(1)
        
        logger.info("🔄 Loop de monitoramento finalizado")

    def _test_default_targets(self):
        """Testa destinos padrão"""
        # Google DNS
        logger.debug("🌐 Testando 8.8.8.8 (Google DNS)")
        result = self.ping_target("8.8.8.8")
        logger.info(f"📍 Ping 8.8.8.8: {result['latency']}ms ({'✅' if result['success'] else '❌'})")
        
        self._add_to_history(result)
        self._notify_callbacks({
            "type": "ping_result",
            "data": result
        })
        
        # Gateway
        gateway = self.get_default_gateway()
        if gateway:
            logger.debug(f"🏠 Testando gateway: {gateway}")
            result = self.ping_target(gateway)
            result["target"] = "gateway"  # Normaliza nome
            logger.info(f"📍 Ping Gateway ({gateway}): {result['latency']}ms ({'✅' if result['success'] else '❌'})")
            
            self._add_to_history(result)
            self._notify_callbacks({
                "type": "ping_result",
                "data": result
            })

    def _test_custom_targets(self):
        """Testa destinos personalizados"""
        if not self.custom_targets:
            logger.debug("📭 Nenhum destino personalizado configurado")
            return
        
        logger.info(f"🎯 Testando {len(self.custom_targets)} destinos personalizados")
        
        for ip, info in self.custom_targets.items():
            if not info.get("enabled", True):
                logger.debug(f"⏸️ Destino {ip} desabilitado, pulando")
                continue
            
            logger.debug(f"🎯 Testando {info['name']} ({ip})")
            result = self.ping_target(ip)
            logger.info(f"📍 Ping {info['name']} ({ip}): {result['latency']}ms ({'✅' if result['success'] else '❌'})")
            
            self._add_to_history(result)
            self._notify_callbacks({
                "type": "ping_result",
                "data": result
            })

    def _test_network_speed(self):
        """Testa velocidade de rede"""
        try:
            speed_data = self.get_network_speed()
            logger.debug(f"🚀 Velocidade: ↓{speed_data['download_mbps']}Mbps ↑{speed_data['upload_mbps']}Mbps")
            
            self._notify_callbacks({
                "type": "network_speed",
                "data": speed_data
            })
        except Exception as e:
            logger.error(f"❌ Erro ao testar velocidade: {e}")

    def _add_to_history(self, result: Dict):
        """Adiciona resultado ao histórico"""
        self.ping_history.append(result)
        
        # Limita tamanho do histórico
        if len(self.ping_history) > self.max_history:
            self.ping_history = self.ping_history[-self.max_history:]

    def get_ping_history(self) -> List[Dict]:
        """Retorna histórico de pings"""
        return self.ping_history.copy()

    def update_config(self, ping_interval: int = None, failure_threshold: int = None):
        """Atualiza configurações do monitor"""
        if ping_interval is not None:
            self.ping_interval = max(1, min(60, ping_interval))
        
        if failure_threshold is not None:
            self.failure_threshold = max(1, min(10, failure_threshold))
        
        logger.info(f"⚙️ Configurações atualizadas: interval={self.ping_interval}s, threshold={self.failure_threshold}")

    def get_stats(self) -> Dict:
        """Retorna estatísticas do monitor"""
        total_pings = len(self.ping_history)
        successful_pings = sum(1 for result in self.ping_history if result["success"])
        
        return {
            "total_pings": total_pings,
            "successful_pings": successful_pings,
            "success_rate": round((successful_pings / total_pings * 100) if total_pings > 0 else 0, 2),
            "custom_targets_count": len(self.custom_targets),
            "is_running": self.is_running,
            "ping_interval": self.ping_interval,
            "failure_threshold": self.failure_threshold
        }

