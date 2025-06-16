import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Power, PowerOff, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';

const Settings = ({ onAddTarget, onRemoveTarget, onToggleTarget }) => {
  const [newTarget, setNewTarget] = useState({ ip: '', name: '' });
  const [targets, setTargets] = useState({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Carrega status atual
  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/status');
      if (response.ok) {
        const data = await response.json();
        setTargets(data);
      }
    } catch (error) {
      console.error('Erro ao carregar targets:', error);
    }
  };

  const handleAddTarget = async () => {
    if (!newTarget.ip || !newTarget.name) {
      toast({
        title: "Erro",
        description: "Por favor, preencha IP e nome do destino.",
        variant: "destructive"
      });
      return;
    }

    // Validação básica de IP
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(newTarget.ip)) {
      toast({
        title: "Erro",
        description: "Por favor, insira um endereço IP válido.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await onAddTarget(newTarget.ip, newTarget.name, true);
      setNewTarget({ ip: '', name: '' });
      await loadTargets();
      
      toast({
        title: "Sucesso",
        description: `Destino ${newTarget.name} adicionado com sucesso.`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao adicionar destino. Verifique se o IP não está duplicado.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTarget = async (ip) => {
    setLoading(true);
    try {
      await onRemoveTarget(ip);
      await loadTargets();
      
      toast({
        title: "Sucesso",
        description: "Destino removido com sucesso."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover destino.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTarget = async (ip, enabled) => {
    try {
      await onToggleTarget(ip, enabled);
      await loadTargets();
      
      toast({
        title: "Sucesso",
        description: `Destino ${enabled ? 'ativado' : 'desativado'} com sucesso.`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao alterar status do destino.",
        variant: "destructive"
      });
    }
  };

  const allTargets = { ...targets.targets, ...targets.custom_targets };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie destinos de monitoramento e configurações</p>
      </div>

      {/* Adicionar novo destino */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Novo Destino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ip">Endereço IP</Label>
              <Input
                id="ip"
                placeholder="192.168.1.100"
                value={newTarget.ip}
                onChange={(e) => setNewTarget(prev => ({ ...prev, ip: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome Identificador</Label>
              <Input
                id="name"
                placeholder="Servidor AD, Impressora, etc."
                value={newTarget.name}
                onChange={(e) => setNewTarget(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>
          <Button 
            onClick={handleAddTarget} 
            disabled={loading}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar Destino
          </Button>
        </CardContent>
      </Card>

      {/* Lista de destinos */}
      <Card>
        <CardHeader>
          <CardTitle>Destinos Configurados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(allTargets).map(([ip, config]) => (
              <div key={ip} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {config.enabled ? (
                      <Power className="h-5 w-5 text-green-500" />
                    ) : (
                      <PowerOff className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  
                  <div>
                    <div className="font-medium">{config.name}</div>
                    <div className="text-sm text-muted-foreground">{ip}</div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Badge variant={config.enabled ? "default" : "secondary"}>
                      {config.enabled ? "Ativo" : "Inativo"}
                    </Badge>
                    
                    {ip === "8.8.8.8" && (
                      <Badge variant="outline">Google DNS</Badge>
                    )}
                    
                    {ip === "gateway" && (
                      <Badge variant="outline">Gateway</Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(enabled) => handleToggleTarget(ip, enabled)}
                  />
                  
                  {/* Só permite remover IPs personalizados */}
                  {ip !== "8.8.8.8" && ip !== "gateway" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveTarget(ip)}
                      disabled={loading}
                      className="gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {Object.keys(allTargets).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum destino configurado
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configurações avançadas */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Avançadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ping-interval">Intervalo de Ping (segundos)</Label>
              <Input
                id="ping-interval"
                type="number"
                min="1"
                max="60"
                defaultValue="5"
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="failure-threshold">Limite de Falhas Consecutivas</Label>
              <Input
                id="failure-threshold"
                type="number"
                min="1"
                max="10"
                defaultValue="3"
                placeholder="3"
              />
            </div>
          </div>
          
          <Button variant="outline" className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;

