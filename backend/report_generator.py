import os
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class ReportGenerator:
    def __init__(self):
        # Diretório de relatórios
        self.reports_dir = Path.home() / "NetworkMonitor" / "Reports"
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        
        # Controle de falhas ativas
        self.active_failures = {}  # {target: {start_time, packets_lost, last_seen}}
        self.failure_threshold = 3  # Número de falhas consecutivas para gerar relatório
        
        logger.info(f"✅ ReportGenerator inicializado - Diretório: {self.reports_dir}")

    def process_ping_result(self, result: Dict):
        """Processa resultado de ping e detecta falhas para relatórios automáticos"""
        target = result.get("target", "unknown")
        success = result.get("success", False)
        timestamp = result.get("timestamp", datetime.now().isoformat())
        latency = result.get("latency", 0)
        
        logger.debug(f"📊 Processando ping: {target} - {'✅' if success else '❌'}")
        
        if not success:
            # Ping falhou
            self._handle_ping_failure(target, timestamp, latency)
        else:
            # Ping bem-sucedido
            self._handle_ping_success(target, timestamp, latency)

    def _handle_ping_failure(self, target: str, timestamp: str, latency: float):
        """Trata falha de ping"""
        if target not in self.active_failures:
            # Primeira falha
            self.active_failures[target] = {
                "start_time": timestamp,
                "packets_lost": 1,
                "last_seen": timestamp,
                "consecutive_failures": 1
            }
            logger.info(f"🔴 Primeira falha detectada: {target}")
        else:
            # Falha consecutiva
            self.active_failures[target]["packets_lost"] += 1
            self.active_failures[target]["last_seen"] = timestamp
            self.active_failures[target]["consecutive_failures"] += 1
            
            consecutive = self.active_failures[target]["consecutive_failures"]
            logger.warning(f"🔴 Falha consecutiva #{consecutive}: {target}")
            
            # Verifica se deve gerar relatório
            if consecutive >= self.failure_threshold:
                logger.error(f"🚨 LIMITE DE FALHAS ATINGIDO: {target} ({consecutive} falhas)")

    def _handle_ping_success(self, target: str, timestamp: str, latency: float):
        """Trata sucesso de ping"""
        if target in self.active_failures:
            # Fim da falha - gera relatório
            failure_data = self.active_failures[target]
            
            # Só gera relatório se atingiu o threshold
            if failure_data["consecutive_failures"] >= self.failure_threshold:
                self._generate_failure_report(target, failure_data, timestamp)
            
            # Remove da lista de falhas ativas
            del self.active_failures[target]
            logger.info(f"✅ Falha resolvida: {target}")

    def _generate_failure_report(self, target: str, failure_data: Dict, recovery_time: str):
        """Gera relatório automático de falha"""
        try:
            # Dados do relatório
            start_time = datetime.fromisoformat(failure_data["start_time"].replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(recovery_time.replace('Z', '+00:00'))
            duration = end_time - start_time
            
            # Nome amigável do destino
            target_name = self._get_target_friendly_name(target)
            
            report_data = {
                "report_id": f"FAIL_{target.replace('.', '_')}_{start_time.strftime('%Y%m%d_%H%M%S')}",
                "target": target,
                "target_name": target_name,
                "failure_start": failure_data["start_time"],
                "failure_end": recovery_time,
                "duration_seconds": int(duration.total_seconds()),
                "duration_human": str(duration),
                "packets_lost": failure_data["packets_lost"],
                "consecutive_failures": failure_data["consecutive_failures"],
                "severity": self._calculate_severity(failure_data["consecutive_failures"], duration),
                "generated_at": datetime.now().isoformat()
            }
            
            # Salva relatório
            self._save_failure_report(report_data)
            
            logger.error(f"📋 RELATÓRIO DE FALHA GERADO: {target_name} - {failure_data['packets_lost']} pacotes perdidos")
            
            return report_data
            
        except Exception as e:
            logger.error(f"❌ Erro ao gerar relatório de falha: {e}")
            return None

    def _get_target_friendly_name(self, target: str) -> str:
        """Retorna nome amigável do destino"""
        if target == "8.8.8.8":
            return "Google DNS"
        elif target == "gateway":
            return "Gateway Padrão"
        else:
            return f"Destino Personalizado ({target})"

    def _calculate_severity(self, consecutive_failures: int, duration: timedelta) -> str:
        """Calcula severidade da falha"""
        duration_minutes = duration.total_seconds() / 60
        
        if consecutive_failures >= 10 or duration_minutes >= 30:
            return "CRÍTICA"
        elif consecutive_failures >= 5 or duration_minutes >= 10:
            return "ALTA"
        elif consecutive_failures >= 3 or duration_minutes >= 5:
            return "MÉDIA"
        else:
            return "BAIXA"

    def _save_failure_report(self, report_data: Dict):
        """Salva relatório de falha em arquivo"""
        try:
            # Nome do arquivo baseado na data
            date_str = datetime.now().strftime("%Y-%m-%d")
            
            # Arquivo JSON detalhado
            json_file = self.reports_dir / f"failures_{date_str}.json"
            
            # Carrega relatórios existentes ou cria lista vazia
            if json_file.exists():
                with open(json_file, 'r', encoding='utf-8') as f:
                    reports = json.load(f)
            else:
                reports = []
            
            # Adiciona novo relatório
            reports.append(report_data)
            
            # Salva arquivo JSON
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(reports, f, indent=2, ensure_ascii=False)
            
            # Arquivo CSV resumido
            csv_file = self.reports_dir / f"failures_summary_{date_str}.csv"
            
            # Verifica se arquivo CSV existe
            file_exists = csv_file.exists()
            
            # Adiciona linha ao CSV
            with open(csv_file, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                
                # Cabeçalho se arquivo novo
                if not file_exists:
                    writer.writerow([
                        'Data/Hora', 'Destino', 'Nome', 'Início da Falha', 
                        'Fim da Falha', 'Duração (min)', 'Pacotes Perdidos', 
                        'Falhas Consecutivas', 'Severidade'
                    ])
                
                # Dados da falha
                writer.writerow([
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    report_data["target"],
                    report_data["target_name"],
                    report_data["failure_start"],
                    report_data["failure_end"],
                    round(report_data["duration_seconds"] / 60, 2),
                    report_data["packets_lost"],
                    report_data["consecutive_failures"],
                    report_data["severity"]
                ])
            
            logger.info(f"💾 Relatório salvo: {json_file.name}")
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar relatório: {e}")

    def generate_daily_report(self, ping_history: List[Dict]) -> Path:
        """Gera relatório diário consolidado"""
        try:
            date_str = datetime.now().strftime("%Y-%m-%d")
            report_file = self.reports_dir / f"daily_report_{date_str}.json"
            
            # Processa histórico
            stats = self._calculate_daily_stats(ping_history)
            
            # Dados do relatório
            report_data = {
                "report_type": "daily",
                "date": date_str,
                "generated_at": datetime.now().isoformat(),
                "period": {
                    "start": stats.get("first_ping", "N/A"),
                    "end": stats.get("last_ping", "N/A")
                },
                "summary": {
                    "total_pings": stats.get("total_pings", 0),
                    "successful_pings": stats.get("successful_pings", 0),
                    "failed_pings": stats.get("failed_pings", 0),
                    "success_rate": stats.get("success_rate", 0),
                    "average_latency": stats.get("average_latency", 0)
                },
                "targets": stats.get("targets", {}),
                "failures": self._get_daily_failures(date_str)
            }
            
            # Salva relatório
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"📊 Relatório diário gerado: {report_file}")
            return report_file
            
        except Exception as e:
            logger.error(f"❌ Erro ao gerar relatório diário: {e}")
            return None

    def _calculate_daily_stats(self, ping_history: List[Dict]) -> Dict:
        """Calcula estatísticas diárias"""
        if not ping_history:
            return {}
        
        total_pings = len(ping_history)
        successful_pings = sum(1 for p in ping_history if p.get("success", False))
        failed_pings = total_pings - successful_pings
        
        # Latência média (apenas pings bem-sucedidos)
        successful_latencies = [p.get("latency", 0) for p in ping_history if p.get("success", False) and p.get("latency", 0) > 0]
        average_latency = sum(successful_latencies) / len(successful_latencies) if successful_latencies else 0
        
        # Estatísticas por destino
        targets = {}
        for ping in ping_history:
            target = ping.get("target", "unknown")
            if target not in targets:
                targets[target] = {
                    "total": 0,
                    "successful": 0,
                    "failed": 0,
                    "success_rate": 0,
                    "average_latency": 0,
                    "latencies": []
                }
            
            targets[target]["total"] += 1
            if ping.get("success", False):
                targets[target]["successful"] += 1
                if ping.get("latency", 0) > 0:
                    targets[target]["latencies"].append(ping.get("latency", 0))
            else:
                targets[target]["failed"] += 1
        
        # Calcula médias por destino
        for target_data in targets.values():
            if target_data["total"] > 0:
                target_data["success_rate"] = round((target_data["successful"] / target_data["total"]) * 100, 2)
            if target_data["latencies"]:
                target_data["average_latency"] = round(sum(target_data["latencies"]) / len(target_data["latencies"]), 2)
            del target_data["latencies"]  # Remove dados temporários
        
        return {
            "total_pings": total_pings,
            "successful_pings": successful_pings,
            "failed_pings": failed_pings,
            "success_rate": round((successful_pings / total_pings) * 100, 2) if total_pings > 0 else 0,
            "average_latency": round(average_latency, 2),
            "targets": targets,
            "first_ping": ping_history[0].get("timestamp", "N/A") if ping_history else "N/A",
            "last_ping": ping_history[-1].get("timestamp", "N/A") if ping_history else "N/A"
        }

    def _get_daily_failures(self, date_str: str) -> List[Dict]:
        """Obtém falhas do dia"""
        try:
            json_file = self.reports_dir / f"failures_{date_str}.json"
            if json_file.exists():
                with open(json_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []
        except Exception as e:
            logger.error(f"❌ Erro ao obter falhas diárias: {e}")
            return []

    def list_reports(self) -> List[Dict]:
        """Lista todos os relatórios disponíveis"""
        try:
            reports = []
            
            for file_path in self.reports_dir.glob("*.json"):
                try:
                    stat = file_path.stat()
                    reports.append({
                        "filename": file_path.name,
                        "path": str(file_path),
                        "size": stat.st_size,
                        "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "type": "failure" if "failures_" in file_path.name else "daily"
                    })
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao processar arquivo {file_path}: {e}")
            
            # Ordena por data de modificação (mais recente primeiro)
            reports.sort(key=lambda x: x["modified"], reverse=True)
            
            return reports
            
        except Exception as e:
            logger.error(f"❌ Erro ao listar relatórios: {e}")
            return []

    def get_report_content(self, filename: str) -> Optional[Dict]:
        """Obtém conteúdo de um relatório específico"""
        try:
            file_path = self.reports_dir / filename
            if not file_path.exists():
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
                
        except Exception as e:
            logger.error(f"❌ Erro ao ler relatório {filename}: {e}")
            return None

    def get_active_failures(self) -> Dict:
        """Retorna falhas ativas no momento"""
        return self.active_failures.copy()

    def get_failure_summary(self, days: int = 7) -> Dict:
        """Retorna resumo de falhas dos últimos N dias"""
        try:
            summary = {
                "period_days": days,
                "total_failures": 0,
                "targets_affected": set(),
                "severity_count": {"CRÍTICA": 0, "ALTA": 0, "MÉDIA": 0, "BAIXA": 0},
                "daily_breakdown": {}
            }
            
            # Verifica arquivos dos últimos N dias
            for i in range(days):
                date = datetime.now() - timedelta(days=i)
                date_str = date.strftime("%Y-%m-%d")
                
                failures = self._get_daily_failures(date_str)
                summary["daily_breakdown"][date_str] = len(failures)
                summary["total_failures"] += len(failures)
                
                for failure in failures:
                    summary["targets_affected"].add(failure.get("target", "unknown"))
                    severity = failure.get("severity", "BAIXA")
                    if severity in summary["severity_count"]:
                        summary["severity_count"][severity] += 1
            
            summary["targets_affected"] = list(summary["targets_affected"])
            
            return summary
            
        except Exception as e:
            logger.error(f"❌ Erro ao gerar resumo de falhas: {e}")
            return {}

    def cleanup_old_reports(self, days_to_keep: int = 30):
        """Remove relatórios antigos"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            removed_count = 0
            
            for file_path in self.reports_dir.glob("*.json"):
                if file_path.stat().st_mtime < cutoff_date.timestamp():
                    file_path.unlink()
                    removed_count += 1
            
            if removed_count > 0:
                logger.info(f"🗑️ Removidos {removed_count} relatórios antigos")
                
        except Exception as e:
            logger.error(f"❌ Erro ao limpar relatórios antigos: {e}")

