import React, { useState, useEffect } from 'react';
import { FileText, Download, FolderOpen, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de relatórios.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/reports/generate', {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso",
          description: "Relatório gerado com sucesso!"
        });
        await loadReports();
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatório.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openReportsFolder = () => {
    if (window.electronAPI) {
      window.electronAPI.openReportsFolder();
    } else {
      toast({
        title: "Informação",
        description: "Pasta de relatórios: ~/NetworkMonitor/Reports/"
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getReportType = (filename) => {
    if (filename.includes('failure_report')) return 'Falha';
    if (filename.includes('daily_summary')) return 'Resumo Diário';
    if (filename.includes('network_statistics')) return 'Estatísticas';
    return 'Relatório';
  };

  const getReportTypeColor = (type) => {
    switch (type) {
      case 'Falha': return 'destructive';
      case 'Resumo Diário': return 'default';
      case 'Estatísticas': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Visualize e gerencie relatórios de monitoramento</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={openReportsFolder}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Abrir Pasta
          </Button>
          
          <Button 
            onClick={generateReport}
            disabled={loading}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Gerar Relatório
          </Button>
        </div>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Relatórios</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground">
              Arquivos disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Relatórios de Falha</CardTitle>
            <FileText className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.filename.includes('failure_report')).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Falhas detectadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tamanho Total</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(reports.reduce((sum, r) => sum + r.size, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Espaço utilizado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de relatórios */}
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Carregando relatórios...</p>
            </div>
          ) : reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((report) => {
                const reportType = getReportType(report.filename);
                const isCSV = report.filename.endsWith('.csv');
                
                return (
                  <div key={report.filename} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      
                      <div>
                        <div className="font-medium">{report.filename}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(report.created)}</span>
                          <span>•</span>
                          <span>{formatFileSize(report.size)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={getReportTypeColor(reportType)}>
                        {reportType}
                      </Badge>
                      
                      <Badge variant="outline">
                        {isCSV ? 'CSV' : 'TXT'}
                      </Badge>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Em um app real, isso abriria o arquivo
                          toast({
                            title: "Informação",
                            description: `Arquivo: ${report.filepath}`
                          });
                        }}
                        className="gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Abrir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum relatório encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Gere seu primeiro relatório ou aguarde a detecção automática de falhas.
              </p>
              <Button onClick={generateReport} disabled={loading}>
                Gerar Primeiro Relatório
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações sobre relatórios automáticos */}
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Automáticos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">Detecção Automática de Falhas</div>
              <div className="text-sm text-muted-foreground">
                Relatórios são gerados automaticamente quando 3 ou mais pings consecutivos falham para qualquer destino.
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <FolderOpen className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">Local de Armazenamento</div>
              <div className="text-sm text-muted-foreground">
                Os relatórios são salvos em: <code>~/NetworkMonitor/Reports/</code>
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">Formatos Disponíveis</div>
              <div className="text-sm text-muted-foreground">
                Relatórios são gerados em formato TXT (legível) e CSV (para análise em planilhas).
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;

