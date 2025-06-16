const { app, BrowserWindow, Menu, Tray, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Variáveis globais
let mainWindow;
let tray;
let backendProcess;
let isQuitting = false;

// Configuração do aplicativo
const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 8000;
const FRONTEND_URL = `http://localhost:${BACKEND_PORT}`;

function createWindow() {
    // Cria a janela principal
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false, // Não mostra inicialmente
        titleBarStyle: 'default',
        autoHideMenuBar: true // Esconde menu bar por padrão
    });

    // Carrega a aplicação
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadURL(FRONTEND_URL);
    }

    // Eventos da janela
    mainWindow.once('ready-to-show', () => {
        if (!app.getLoginItemSettings().wasOpenedAsHidden) {
            mainWindow.show();
        }
    });

    // Minimizar para bandeja em vez de fechar
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            
            // Mostra notificação apenas na primeira vez
            if (process.platform === 'win32') {
                tray.displayBalloon({
                    iconType: 'info',
                    title: 'Network Monitor',
                    content: 'O aplicativo continua rodando na bandeja do sistema.'
                });
            }
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    // Ícone da bandeja
    const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    tray = new Tray(trayIconPath);

    // Tooltip
    tray.setToolTip('Network Monitor - Monitoramento de Rede');

    // Menu de contexto
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Abrir Painel',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        {
            label: 'Ver Relatórios',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                    // Envia evento para mudar para aba de relatórios
                    mainWindow.webContents.send('switch-tab', 'reports');
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Iniciar com o Sistema',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: (menuItem) => {
                app.setLoginItemSettings({
                    openAtLogin: menuItem.checked,
                    openAsHidden: true
                });
            }
        },
        { type: 'separator' },
        {
            label: 'Sobre',
            click: () => {
                const aboutWindow = new BrowserWindow({
                    width: 400,
                    height: 300,
                    resizable: false,
                    minimizable: false,
                    maximizable: false,
                    parent: mainWindow,
                    modal: true,
                    icon: path.join(__dirname, 'assets', 'icon.png'),
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                });

                aboutWindow.loadFile(path.join(__dirname, 'about.html'));
                aboutWindow.setMenuBarVisibility(false);
            }
        },
        {
            label: 'Sair',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    // Clique simples na bandeja
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        } else {
            createWindow();
        }
    });

    // Duplo clique na bandeja
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        } else {
            createWindow();
        }
    });
}

function startBackend() {
    console.log('🚀 Iniciando backend...');
    
    const backendPath = path.join(__dirname, '..', 'backend');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // Inicia o processo do backend
    backendProcess = spawn(pythonCmd, ['main.py'], {
        cwd: backendPath,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    backendProcess.stdout.on('data', (data) => {
        console.log(`Backend: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('close', (code) => {
        console.log(`Backend process exited with code ${code}`);
        if (!isQuitting && code !== 0) {
            // Tenta reiniciar o backend se não foi um encerramento intencional
            setTimeout(startBackend, 5000);
        }
    });

    backendProcess.on('error', (error) => {
        console.error('Erro ao iniciar backend:', error);
    });
}

function stopBackend() {
    if (backendProcess) {
        console.log('🛑 Parando backend...');
        backendProcess.kill();
        backendProcess = null;
    }
}

// Eventos do aplicativo
app.whenReady().then(() => {
    // Inicia backend
    startBackend();
    
    // Aguarda um pouco para o backend inicializar
    setTimeout(() => {
        createWindow();
        createTray();
    }, 3000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
        }
    });
});

app.on('window-all-closed', () => {
    // No macOS, aplicativos geralmente ficam ativos mesmo quando todas as janelas são fechadas
    if (process.platform !== 'darwin') {
        // Não sai do app, apenas esconde
        // app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
    stopBackend();
});

app.on('will-quit', (event) => {
    if (!isQuitting) {
        event.preventDefault();
    }
});

// Previne múltiplas instâncias
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Alguém tentou executar uma segunda instância, foca na janela existente
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('minimize-to-tray', () => {
    if (mainWindow) {
        mainWindow.hide();
    }
});

ipcMain.handle('show-window', () => {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
});

// Configurações de segurança
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// Auto-updater (para versões futuras)
if (!isDev) {
    // Aqui você pode adicionar auto-updater
    // const { autoUpdater } = require('electron-updater');
    // autoUpdater.checkForUpdatesAndNotify();
}

