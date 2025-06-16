import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = 'ws://localhost:8000/ws';

export function useNetworkMonitor() {
  const [pingData, setPingData] = useState([]);
  const [networkSpeed, setNetworkSpeed] = useState({
    upload_mbps: 0,
    download_mbps: 0,
    timestamp: null
  });
  const [isConnected, setIsConnected] = useState(false);
  const [targets, setTargets] = useState({});
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Envia ping para manter conexão viva
        const pingInterval = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'ping_result') {
            setPingData(prev => {
              const newData = [...prev, data.data];
              // Mantém apenas os últimos 100 registros
              return newData.slice(-100);
            });
          } else if (data.type === 'network_speed') {
            setNetworkSpeed(data.data);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket desconectado');
        setIsConnected(false);
        
        // Tenta reconectar
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Backoff exponencial
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };

    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  // Funções da API
  const addCustomTarget = useCallback(async (ip, name, enabled = true) => {
    try {
      const response = await fetch('http://localhost:8000/api/targets/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ip, name, enabled }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao adicionar target');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao adicionar target:', error);
      throw error;
    }
  }, []);

  const removeCustomTarget = useCallback(async (ip) => {
    try {
      const response = await fetch(`http://localhost:8000/api/targets/custom/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Erro ao remover target');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao remover target:', error);
      throw error;
    }
  }, []);

  const toggleTarget = useCallback(async (ip, enabled) => {
    try {
      const response = await fetch('http://localhost:8000/api/targets/toggle', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ip, enabled }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao alterar status do target');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao alterar status do target:', error);
      throw error;
    }
  }, []);

  const getStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/status');
      if (!response.ok) {
        throw new Error('Erro ao obter status');
      }
      
      const status = await response.json();
      setTargets(status);
      return status;
    } catch (error) {
      console.error('Erro ao obter status:', error);
      throw error;
    }
  }, []);

  const generateReport = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/reports/generate', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      throw error;
    }
  }, []);

  const getReports = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/reports');
      if (!response.ok) {
        throw new Error('Erro ao obter relatórios');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao obter relatórios:', error);
      throw error;
    }
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    pingData,
    networkSpeed,
    isConnected,
    targets,
    connect,
    disconnect,
    addCustomTarget,
    removeCustomTarget,
    toggleTarget,
    getStatus,
    generateReport,
    getReports
  };
}

