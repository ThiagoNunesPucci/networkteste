import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import './App.css';

// Componentes
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Reports from './components/Reports';
import Sidebar from './components/Sidebar';

// Hook para WebSocket
import { useNetworkMonitor } from './hooks/useNetworkMonitor';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { 
    pingData, 
    networkSpeed, 
    isConnected, 
    connect, 
    disconnect,
    addCustomTarget,
    removeCustomTarget,
    toggleTarget 
  } = useNetworkMonitor();

  useEffect(() => {
    // Conecta ao WebSocket quando o app inicia
    connect();

    // Listener para navegação via Electron
    if (window.electronAPI) {
      window.electronAPI.onNavigateTo((route) => {
        if (route === '/settings') {
          setCurrentPage('settings');
        } else if (route === '/reports') {
          setCurrentPage('reports');
        } else {
          setCurrentPage('dashboard');
        }
      });
    }

    return () => {
      disconnect();
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('navigate-to');
      }
    };
  }, [connect, disconnect]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="flex h-screen bg-background text-foreground">
        {/* Sidebar */}
        <Sidebar 
          currentPage={currentPage} 
          onPageChange={setCurrentPage}
          isConnected={isConnected}
        />
        
        {/* Conteúdo principal */}
        <main className="flex-1 overflow-hidden">
          {currentPage === 'dashboard' && (
            <Dashboard 
              pingData={pingData}
              networkSpeed={networkSpeed}
              isConnected={isConnected}
            />
          )}
          
          {currentPage === 'settings' && (
            <Settings 
              onAddTarget={addCustomTarget}
              onRemoveTarget={removeCustomTarget}
              onToggleTarget={toggleTarget}
            />
          )}
          
          {currentPage === 'reports' && (
            <Reports />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;

