import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Wifi, 
  Download, 
  Upload, 
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const Dashboard = ({ pingData, networkSpeed, isConnected }) => {
  const [chartData, setChartData] = useState([]);
  const [speedData, setSpeedData] = useState([]);
  const [stats, setStats] = useState({
    totalPings: 0,
    successfulPings: 0,
    failedPings: 0,
    avgLatency: 0
  });

  // Processa dados para os gráficos
  useEffect(() => {
    if (pingData.length > 0) {
      // Dados do gráfico de latência
      const latencyData = pingData.slice(-20).map((ping, index) => ({
        time: new Date(ping.timestamp).toLocaleTimeString(),
        [ping.name || ping.target]: ping.success ? ping.latency : null,
        success: ping.success
      }));
      
      setChartData(latencyData);

      // Calcula estatísticas
      const total = pingData.length;
      const successful = pingData.filter(p => p.success).length;
      const failed = total - successful;
      const avgLat = successful > 0 
        ? pingData.filter(p => p.success).reduce((sum, p) => sum + p.latency, 0) / successful 
        : 0;

      setStats({
        totalPings: total,
        successfulPings: successful,
        failedPings: failed,
        avgLatency: avgLat
      });
    }
  }, [pingData]);

  // Processa dados de velocidade
  useEffect(() => {
    if (networkSpeed.timestamp) {
      setSpeedData(prev => {
        const newData = [...prev, {
          time: new Date(networkSpeed.timestamp).toLocaleTimeString(),
          download: networkSpeed.download_mbps,
          upload: networkSpeed.upload_mbps
        }];
        return newData.slice(-20); // Mantém apenas os últimos 20 pontos
      });
    }
  }, [networkSpeed]);

  // Obtém status dos destinos únicos
  const getTargetStatus = () => {
    const targets = {};
    pingData.slice(-10).forEach(ping => {
      const key = ping.target;
      if (!targets[key] || new Date(ping.timestamp) > new Date(targets[key].timestamp)) {
        targets[key] = ping;
      }
    });
    return Object.values(targets);
  };

  const targetStatuses = getTargetStatus();

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Monitoramento de rede em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pings</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPings}</div>
            <p className="text-xs text-muted-foreground">
              Desde o início da sessão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalPings > 0 ? ((stats.successfulPings / stats.totalPings) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.successfulPings} de {stats.totalPings} pings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latência Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgLatency.toFixed(1)}ms</div>
            <p className="text-xs text-muted-foreground">
              Tempo de resposta médio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failedPings}</div>
            <p className="text-xs text-muted-foreground">
              Pings sem resposta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status dos destinos */}
      <Card>
        <CardHeader>
          <CardTitle>Status dos Destinos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targetStatuses.map((target) => (
              <div key={target.target} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {target.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium">{target.name || target.target}</div>
                    <div className="text-sm text-muted-foreground">{target.target}</div>
                  </div>
                </div>
                <div className="text-right">
                  {target.success ? (
                    <div className="text-sm font-medium">{target.latency}ms</div>
                  ) : (
                    <div className="text-sm text-red-500">Falha</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(target.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Latência */}
        <Card>
          <CardHeader>
            <CardTitle>Latência em Tempo Real</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  {/* Linhas dinâmicas baseadas nos destinos */}
                  {chartData.length > 0 && Object.keys(chartData[0])
                    .filter(key => key !== 'time' && key !== 'success')
                    .map((key, index) => (
                      <Line 
                        key={key}
                        type="monotone" 
                        dataKey={key} 
                        stroke={`hsl(${index * 120}, 70%, 50%)`}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    ))
                  }
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Velocidade */}
        <Card>
          <CardHeader>
            <CardTitle>Velocidade de Rede</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={speedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="download" 
                    stackId="1"
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="upload" 
                    stackId="1"
                    stroke="#82ca9d" 
                    fill="#82ca9d" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* Velocidade atual */}
            <div className="flex justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Download: {networkSpeed.download_mbps?.toFixed(2) || 0} Mbps</span>
              </div>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-green-500" />
                <span className="text-sm">Upload: {networkSpeed.upload_mbps?.toFixed(2) || 0} Mbps</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

