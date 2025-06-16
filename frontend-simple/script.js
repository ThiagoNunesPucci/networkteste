// Network Monitor - SEM DUPLA AUTENTICAÇÃO
// Versão 1.2.1 - Interface original com autenticação simples

class NetworkMonitor {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.pingData = {};
        this.networkChart = null;
        this.customTargets = {};
        this.authenticated = false;
        
        console.log('🚀 Inicializando Network Monitor v1.2.1...');
        this.init();
    }

    async init() {
        try {
            // Verifica se já está autenticado
            const savedAuth = localStorage.getItem('networkMonitorAuth');
            if (savedAuth) {
                this.authenticated = true;
                console.log('✅ Usuário já autenticado');
            }
            
            // Inicializa componentes
            this.setupEventListeners();
            this.connectWebSocket();
            this.initializeChart();
            this.loadInitialData();
            this.startStatsUpdate();
            
            console.log('✅ Network Monitor inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
        }
    }

    setupEventListeners() {
        // Navegação
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.closest('.nav-item').dataset.section;
                this.showSection(section);
            });
        });

        // Formulário de destino personalizado
        const addTargetForm = document.getElementById('addTargetForm');
        if (addTargetForm) {
            addTargetForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addCustomTarget();
            });
        }

        // Modal de edição
        const editModal = document.getElementById('editTargetModal');
        if (editModal) {
            const saveBtn = editModal.querySelector('.save-btn');
            const cancelBtn = editModal.querySelector('.cancel-btn');
            
            if (saveBtn) saveBtn.addEventListener('click', () => this.saveTargetEdit());
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeEditModal());
        }

        // Botão de gerar relatório
        const generateReportBtn = document.getElementById('generateReport');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => this.generateReport());
        }

        // Atualizar relatórios
        const refreshReportsBtn = document.getElementById('refreshReports');
        if (refreshReportsBtn) {
            refreshReportsBtn.addEventListener('click', () => this.loadReports());
        }
    }

    showSection(sectionName) {
        // Esconde todas as seções
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        // Remove classe ativa de todos os itens de navegação
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Mostra seção selecionada
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // Adiciona classe ativa ao item de navegação
        const activeNavItem = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Carrega dados específicos da seção
        if (sectionName === 'configuracoes') {
            this.loadCustomTargets();
        } else if (sectionName === 'relatorios') {
            this.loadReports();
        }

        console.log(`📄 Seção ativa: ${sectionName}`);
    }

    connectWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            console.log('🔌 Conectando WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket conectado');
                this.isConnected = true;
                this.updateConnectionStatus(true);
                
                // Envia ping para manter conexão
                setInterval(() => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({type: 'ping'}));
                    }
                }, 30000);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ Erro ao processar mensagem WebSocket:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('❌ WebSocket desconectado');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                
                // Reconecta após 5 segundos
                setTimeout(() => {
                    if (!this.isConnected) {
                        console.log('🔄 Tentando reconectar...');
                        this.connectWebSocket();
                    }
                }, 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ Erro no WebSocket:', error);
            };
            
        } catch (error) {
            console.error('❌ Erro ao conectar WebSocket:', error);
        }
    }

    handleWebSocketMessage(data) {
        console.log('📨 Mensagem WebSocket:', data.type);
        
        switch (data.type) {
            case 'ping_result':
                this.updatePingData(data.data);
                break;
            case 'network_speed':
                this.updateNetworkSpeed(data.data);
                break;
            case 'target_added':
                this.handleTargetAdded(data.data);
                break;
            case 'target_updated':
                this.handleTargetUpdated(data.data);
                break;
            case 'target_removed':
                this.handleTargetRemoved(data.data);
                break;
            case 'initial_targets':
                this.handleInitialTargets(data.data);
                break;
            case 'failure_report':
                this.handleFailureReport(data.data);
                break;
            case 'pong':
                // Resposta ao ping
                break;
            default:
                console.log('📨 Tipo de mensagem desconhecido:', data.type);
        }
    }

    updatePingData(data) {
        const target = data.target;
        const success = data.success;
        const latency = data.latency;
        
        // Atualiza dados
        this.pingData[target] = {
            success: success,
            latency: latency,
            timestamp: data.timestamp,
            error: data.error
        };
        
        // Atualiza interface
        this.updateTargetCard(target, success, latency);
        
        // Atualiza gráfico se necessário
        if (this.networkChart && (target === '8.8.8.8' || target === 'gateway')) {
            this.updateChart(target, latency, success);
        }
    }

    updateTargetCard(target, success, latency) {
        let cardId;
        
        if (target === '8.8.8.8') {
            cardId = 'googleDnsCard';
        } else if (target === 'gateway') {
            cardId = 'gatewayCard';
        } else {
            // Destino personalizado
            cardId = `custom-${target.replace(/\./g, '-')}`;
        }
        
        const card = document.getElementById(cardId);
        if (!card) return;
        
        const latencyElement = card.querySelector('.latency');
        const statusElement = card.querySelector('.status');
        
        if (latencyElement) {
            if (success && latency > 0) {
                latencyElement.textContent = `${latency.toFixed(1)} ms`;
                latencyElement.style.color = '#00d4aa';
            } else {
                latencyElement.textContent = '-- ms';
                latencyElement.style.color = '#ff6b6b';
            }
        }
        
        if (statusElement) {
            if (success) {
                statusElement.textContent = 'Online';
                statusElement.className = 'status online';
            } else {
                statusElement.textContent = 'Offline';
                statusElement.className = 'status offline';
            }
        }
    }

    updateNetworkSpeed(data) {
        const downloadElement = document.querySelector('.download-speed');
        const uploadElement = document.querySelector('.upload-speed');
        
        if (downloadElement) {
            downloadElement.textContent = `${data.download_mbps.toFixed(1)} Mbps`;
        }
        
        if (uploadElement) {
            uploadElement.textContent = `${data.upload_mbps.toFixed(1)} Mbps`;
        }
        
        // Atualiza gráfico de velocidade
        if (this.networkChart) {
            this.updateSpeedChart(data.download_mbps, data.upload_mbps);
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('.connection-status');
        if (statusElement) {
            if (connected) {
                statusElement.textContent = 'Conectado';
                statusElement.className = 'connection-status connected';
            } else {
                statusElement.textContent = 'Desconectado';
                statusElement.className = 'connection-status disconnected';
            }
        }
    }

    initializeChart() {
        const ctx = document.getElementById('networkChart');
        if (!ctx) return;
        
        this.networkChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Download (Mbps)',
                    data: [],
                    borderColor: '#00d4aa',
                    backgroundColor: 'rgba(0, 212, 170, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Upload (Mbps)',
                    data: [],
                    borderColor: '#ff9f43',
                    backgroundColor: 'rgba(255, 159, 67, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8892b0',
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        display: true,
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8892b0'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#8892b0'
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 0
                    }
                }
            }
        });
    }

    updateSpeedChart(download, upload) {
        if (!this.networkChart) return;
        
        const now = new Date().toLocaleTimeString();
        const maxPoints = 15;
        
        // Adiciona novos dados
        this.networkChart.data.labels.push(now);
        this.networkChart.data.datasets[0].data.push(download);
        this.networkChart.data.datasets[1].data.push(upload);
        
        // Remove dados antigos
        if (this.networkChart.data.labels.length > maxPoints) {
            this.networkChart.data.labels.shift();
            this.networkChart.data.datasets[0].data.shift();
            this.networkChart.data.datasets[1].data.shift();
        }
        
        this.networkChart.update('none');
    }

    async loadInitialData() {
        try {
            const response = await fetch('/api/status');
            
            if (response.ok) {
                const data = await response.json();
                console.log('📊 Dados iniciais carregados:', data);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
        }
    }

    async loadCustomTargets() {
        try {
            const response = await fetch('/api/targets');
            
            if (response.ok) {
                const data = await response.json();
                this.customTargets = data.custom_targets || {};
                this.renderCustomTargetsList();
                console.log('📋 Destinos personalizados carregados:', this.customTargets);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar destinos:', error);
        }
    }

    renderCustomTargetsList() {
        const container = document.getElementById('customTargetsList');
        if (!container) return;
        
        if (Object.keys(this.customTargets).length === 0) {
            container.innerHTML = '<p class="no-targets">Nenhum destino personalizado configurado</p>';
            return;
        }
        
        let html = '<div class="targets-list">';
        
        for (const [ip, target] of Object.entries(this.customTargets)) {
            const statusClass = target.enabled ? 'enabled' : 'disabled';
            html += `
                <div class="target-item ${statusClass}">
                    <div class="target-info">
                        <div class="target-name">${target.name}</div>
                        <div class="target-ip">${ip}</div>
                        <div class="target-status">${target.enabled ? 'Ativo' : 'Inativo'}</div>
                    </div>
                    <div class="target-actions">
                        <button class="edit-btn" onclick="networkMonitor.editTarget('${ip}')">
                            ✏️ Editar
                        </button>
                        <button class="remove-btn" onclick="networkMonitor.removeTarget('${ip}')">
                            🗑️ Remover
                        </button>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    async addCustomTarget() {
        const form = document.getElementById('addTargetForm');
        const formData = new FormData(form);
        
        const targetData = {
            ip: formData.get('ip'),
            name: formData.get('name'),
            enabled: true
        };
        
        try {
            console.log('🎯 Adicionando destino:', targetData);
            
            const response = await fetch('/api/targets/custom', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(targetData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Destino adicionado:', result);
                
                // Limpa formulário
                form.reset();
                
                // Recarrega lista
                this.loadCustomTargets();
                
                // Mostra toast de sucesso
                this.showToast('Destino adicionado com sucesso!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Erro ao adicionar destino');
            }
        } catch (error) {
            console.error('❌ Erro ao adicionar destino:', error);
            this.showToast(`Erro: ${error.message}`, 'error');
        }
    }

    editTarget(ip) {
        const target = this.customTargets[ip];
        if (!target) return;
        
        // Preenche modal de edição
        const modal = document.getElementById('editTargetModal');
        const nameInput = modal.querySelector('#editTargetName');
        const ipInput = modal.querySelector('#editTargetIp');
        const enabledInput = modal.querySelector('#editTargetEnabled');
        
        if (nameInput) nameInput.value = target.name;
        if (ipInput) ipInput.value = ip;
        if (enabledInput) enabledInput.checked = target.enabled;
        
        // Salva IP original para referência
        modal.dataset.originalIp = ip;
        
        // Mostra modal
        modal.style.display = 'flex';
    }

    closeEditModal() {
        const modal = document.getElementById('editTargetModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async saveTargetEdit() {
        const modal = document.getElementById('editTargetModal');
        const originalIp = modal.dataset.originalIp;
        
        const nameInput = modal.querySelector('#editTargetName');
        const ipInput = modal.querySelector('#editTargetIp');
        const enabledInput = modal.querySelector('#editTargetEnabled');
        
        const updateData = {
            name: nameInput.value,
            ip: ipInput.value,
            enabled: enabledInput.checked
        };
        
        try {
            console.log('📝 Atualizando destino:', originalIp, updateData);
            
            const response = await fetch(`/api/targets/custom/${originalIp}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Destino atualizado:', result);
                
                // Fecha modal
                this.closeEditModal();
                
                // Recarrega lista
                this.loadCustomTargets();
                
                // Mostra toast de sucesso
                this.showToast('Destino atualizado com sucesso!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Erro ao atualizar destino');
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar destino:', error);
            this.showToast(`Erro: ${error.message}`, 'error');
        }
    }

    async removeTarget(ip) {
        if (!confirm(`Tem certeza que deseja remover o destino ${ip}?`)) {
            return;
        }
        
        try {
            console.log('🗑️ Removendo destino:', ip);
            
            const response = await fetch(`/api/targets/custom/${ip}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Destino removido:', result);
                
                // Recarrega lista
                this.loadCustomTargets();
                
                // Mostra toast de sucesso
                this.showToast('Destino removido com sucesso!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Erro ao remover destino');
            }
        } catch (error) {
            console.error('❌ Erro ao remover destino:', error);
            this.showToast(`Erro: ${error.message}`, 'error');
        }
    }

    handleTargetAdded(data) {
        console.log('🎯 Novo destino adicionado:', data);
        
        // Adiciona aos destinos locais
        this.customTargets[data.ip] = {
            name: data.name,
            enabled: data.enabled
        };
        
        // Cria card na dashboard
        this.createCustomTargetCard(data.ip, data.name);
        
        // Atualiza lista se estiver na seção de configurações
        if (document.getElementById('configuracoes').style.display !== 'none') {
            this.renderCustomTargetsList();
        }
        
        this.showToast(`Destino ${data.name} adicionado!`, 'success');
    }

    handleTargetUpdated(data) {
        console.log('📝 Destino atualizado:', data);
        
        // Remove destino antigo se IP mudou
        if (data.old_ip !== data.ip) {
            delete this.customTargets[data.old_ip];
            this.removeCustomTargetCard(data.old_ip);
        }
        
        // Atualiza destino
        this.customTargets[data.ip] = {
            name: data.name,
            enabled: data.enabled
        };
        
        // Atualiza ou cria card
        this.createCustomTargetCard(data.ip, data.name);
        
        // Atualiza lista se estiver na seção de configurações
        if (document.getElementById('configuracoes').style.display !== 'none') {
            this.renderCustomTargetsList();
        }
        
        this.showToast(`Destino ${data.name} atualizado!`, 'success');
    }

    handleTargetRemoved(data) {
        console.log('🗑️ Destino removido:', data);
        
        // Remove dos destinos locais
        delete this.customTargets[data.ip];
        
        // Remove card da dashboard
        this.removeCustomTargetCard(data.ip);
        
        // Atualiza lista se estiver na seção de configurações
        if (document.getElementById('configuracoes').style.display !== 'none') {
            this.renderCustomTargetsList();
        }
        
        this.showToast('Destino removido!', 'info');
    }

    handleInitialTargets(data) {
        console.log('📋 Destinos iniciais recebidos:', data);
        
        this.customTargets = data.custom_targets || {};
        
        // Cria cards para destinos personalizados
        for (const [ip, target] of Object.entries(this.customTargets)) {
            this.createCustomTargetCard(ip, target.name);
        }
    }

    handleFailureReport(data) {
        console.log('🚨 Relatório de falha recebido:', data);
        
        // Mostra notificação de falha
        this.showToast(
            `FALHA DETECTADA: ${data.target_name} - ${data.packets_lost} pacotes perdidos`,
            'error',
            10000 // 10 segundos
        );
        
        // Atualiza relatórios se estiver na seção
        if (document.getElementById('relatorios').style.display !== 'none') {
            this.loadReports();
        }
    }

    createCustomTargetCard(ip, name) {
        const container = document.getElementById('customTargetsContainer');
        if (!container) return;
        
        const cardId = `custom-${ip.replace(/\./g, '-')}`;
        
        // Remove card existente se houver
        const existingCard = document.getElementById(cardId);
        if (existingCard) {
            existingCard.remove();
        }
        
        const cardHtml = `
            <div class="card" id="${cardId}">
                <div class="card-header">
                    <span class="card-icon">🎯</span>
                    <span class="card-title">${name}</span>
                </div>
                <div class="card-content">
                    <div class="latency">-- ms</div>
                    <div class="target-ip">${ip}</div>
                    <div class="status verificando">Verificando...</div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', cardHtml);
        console.log(`✅ Card criado para ${name} (${ip})`);
    }

    removeCustomTargetCard(ip) {
        const cardId = `custom-${ip.replace(/\./g, '-')}`;
        const card = document.getElementById(cardId);
        if (card) {
            card.remove();
            console.log(`🗑️ Card removido para ${ip}`);
        }
    }

    async loadReports() {
        try {
            const response = await fetch('/api/reports');
            
            if (response.ok) {
                const data = await response.json();
                this.renderReports(data);
                console.log('📊 Relatórios carregados:', data);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar relatórios:', error);
        }
    }

    renderReports(data) {
        // Renderiza falhas ativas
        this.renderActiveFailures(data.active_failures || {});
        
        // Renderiza resumo
        this.renderReportSummary(data.summary || {});
        
        // Renderiza lista de relatórios
        this.renderReportsList(data.reports || []);
    }

    renderActiveFailures(activeFailures) {
        const container = document.getElementById('activeFailures');
        if (!container) return;
        
        if (Object.keys(activeFailures).length === 0) {
            container.innerHTML = '<p class="no-failures">✅ Nenhuma falha ativa no momento</p>';
            return;
        }
        
        let html = '<div class="failures-list">';
        
        for (const [target, failure] of Object.entries(activeFailures)) {
            const targetName = this.getTargetFriendlyName(target);
            const duration = this.calculateDuration(failure.start_time);
            
            html += `
                <div class="failure-item critical">
                    <div class="failure-header">
                        <span class="failure-target">🚨 ${targetName}</span>
                        <span class="failure-duration">${duration}</span>
                    </div>
                    <div class="failure-details">
                        <span>Pacotes perdidos: ${failure.packets_lost}</span>
                        <span>Falhas consecutivas: ${failure.consecutive_failures}</span>
                        <span>Início: ${new Date(failure.start_time).toLocaleString()}</span>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    renderReportSummary(summary) {
        const container = document.getElementById('reportSummary');
        if (!container) return;
        
        const html = `
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">${summary.total_failures || 0}</div>
                    <div class="summary-label">Falhas (7 dias)</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${(summary.targets_affected || []).length}</div>
                    <div class="summary-label">Destinos Afetados</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.severity_count?.CRÍTICA || 0}</div>
                    <div class="summary-label">Falhas Críticas</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.severity_count?.ALTA || 0}</div>
                    <div class="summary-label">Falhas Altas</div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    renderReportsList(reports) {
        const container = document.getElementById('reportsList');
        if (!container) return;
        
        if (reports.length === 0) {
            container.innerHTML = '<p class="no-reports">📄 Nenhum relatório disponível</p>';
            return;
        }
        
        let html = '<div class="reports-list">';
        
        reports.forEach(report => {
            const date = new Date(report.modified).toLocaleString();
            const size = this.formatFileSize(report.size);
            const typeIcon = report.type === 'failure' ? '🚨' : '📊';
            
            html += `
                <div class="report-item">
                    <div class="report-info">
                        <span class="report-icon">${typeIcon}</span>
                        <div class="report-details">
                            <div class="report-name">${report.filename}</div>
                            <div class="report-meta">${date} • ${size}</div>
                        </div>
                    </div>
                    <div class="report-actions">
                        <button class="view-btn" onclick="networkMonitor.viewReport('${report.filename}')">
                            👁️ Ver
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    async generateReport() {
        try {
            console.log('📊 Gerando relatório...');
            
            const response = await fetch('/api/reports/generate', {
                method: 'POST'
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Relatório gerado:', result);
                
                // Recarrega lista de relatórios
                this.loadReports();
                
                this.showToast('Relatório gerado com sucesso!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Erro ao gerar relatório');
            }
        } catch (error) {
            console.error('❌ Erro ao gerar relatório:', error);
            this.showToast(`Erro: ${error.message}`, 'error');
        }
    }

    async viewReport(filename) {
        try {
            const response = await fetch(`/api/reports/${filename}`);
            
            if (response.ok) {
                const reportData = await response.json();
                this.showReportModal(reportData);
            } else {
                throw new Error('Erro ao carregar relatório');
            }
        } catch (error) {
            console.error('❌ Erro ao visualizar relatório:', error);
            this.showToast(`Erro: ${error.message}`, 'error');
        }
    }

    showReportModal(reportData) {
        // Implementar modal de visualização de relatório
        console.log('📄 Dados do relatório:', reportData);
        
        // Por enquanto, mostra em alert (pode ser melhorado com modal)
        const summary = JSON.stringify(reportData, null, 2);
        alert(`Relatório:\n\n${summary}`);
    }

    getTargetFriendlyName(target) {
        if (target === '8.8.8.8') return 'Google DNS';
        if (target === 'gateway') return 'Gateway Padrão';
        if (this.customTargets[target]) return this.customTargets[target].name;
        return `Destino (${target})`;
    }

    calculateDuration(startTime) {
        const start = new Date(startTime);
        const now = new Date();
        const diff = now - start;
        
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    startStatsUpdate() {
        setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    updateStats() {
        // Atualiza tempo online
        const uptimeElement = document.querySelector('.uptime-value');
        if (uptimeElement) {
            const startTime = new Date(Date.now() - (Math.random() * 3600000)); // Simulado
            const uptime = this.calculateDuration(startTime.toISOString());
            uptimeElement.textContent = uptime;
        }
        
        // Atualiza última atualização
        const lastUpdateElement = document.querySelector('.last-update');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = new Date().toLocaleTimeString();
        }
        
        // Atualiza contador de pings (simulado)
        const pingsElement = document.querySelector('.pings-count');
        if (pingsElement) {
            const currentCount = parseInt(pingsElement.textContent) || 0;
            pingsElement.textContent = currentCount + 1;
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        // Remove toast existente
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Cria novo toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // Adiciona ao DOM
        document.body.appendChild(toast);
        
        // Remove após duração especificada
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);
        
        console.log(`📢 Toast: ${message} (${type})`);
    }
}

// Inicializa quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.networkMonitor = new NetworkMonitor();
});

// Exporta para uso global
window.NetworkMonitor = NetworkMonitor;

