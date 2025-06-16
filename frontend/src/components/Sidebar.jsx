import React from 'react';
import { 
  Activity, 
  Settings, 
  FileText, 
  Wifi, 
  WifiOff,
  Monitor,
  Minimize2
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const Sidebar = ({ currentPage, onPageChange, isConnected }) => {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Activity,
      description: 'Monitoramento em tempo real'
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: Settings,
      description: 'Gerenciar destinos e configurações'
    },
    {
      id: 'reports',
      label: 'Relatórios',
      icon: FileText,
      description: 'Visualizar relatórios de falhas'
    }
  ];

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeToTray();
    }
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Monitor className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Network Monitor</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span>Conectado</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span>Desconectado</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-auto p-3",
                  isActive && "bg-primary text-primary-foreground"
                )}
                onClick={() => onPageChange(item.id)}
              >
                <Icon className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">{item.label}</div>
                  <div className={cn(
                    "text-xs",
                    isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {item.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleMinimize}
        >
          <Minimize2 className="h-4 w-4" />
          Minimizar para bandeja
        </Button>
        
        <div className="mt-3 text-center text-xs text-muted-foreground">
          Network Monitor v1.0
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

