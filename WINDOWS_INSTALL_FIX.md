# Solução para Problemas de Instalação - Windows

## 🚨 Problemas Identificados

### 1. Erro de Permissão (EPERM)
```
Error: EPERM: operation not permitted, rmdir
```

### 2. Erro de Conectividade (ECONNRESET)
```
npm error network read ECONNRESET
```

## ✅ Soluções Passo a Passo

### Solução 1: Executar como Administrador
1. **Feche o PowerShell atual**
2. **Clique com botão direito** no PowerShell
3. **Selecione "Executar como administrador"**
4. **Navegue para a pasta do projeto:**
   ```powershell
   cd "N:\network-monitor\network-monitor-v1.0.1\network-monitor\frontend"
   ```

### Solução 2: Limpar Cache e Reinstalar
```powershell
# Limpar cache do npm
npm cache clean --force

# Remover node_modules (se existir)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# Remover package-lock.json
Remove-Item package-lock.json -ErrorAction SilentlyContinue

# Reinstalar com configurações específicas
npm install --legacy-peer-deps --no-optional --registry https://registry.npmjs.org/
```

### Solução 3: Configurar Proxy/Rede (se necessário)
```powershell
# Se estiver atrás de um proxy corporativo
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port

# Ou desabilitar proxy se não precisar
npm config delete proxy
npm config delete https-proxy

# Configurar timeout maior
npm config set timeout 60000
```

### Solução 4: Usar Yarn (Alternativa)
```powershell
# Instalar Yarn globalmente
npm install -g yarn

# Usar Yarn para instalar dependências
yarn install --ignore-engines
```

### Solução 5: Instalação Manual Simplificada
```powershell
# Instalar apenas dependências essenciais
npm install react react-dom electron --legacy-peer-deps
npm install vite @vitejs/plugin-react --save-dev --legacy-peer-deps
npm install tailwindcss --legacy-peer-deps
```

## 🔧 Script Automatizado de Correção

Crie um arquivo `fix-install.bat` com o conteúdo:

```batch
@echo off
echo === Corrigindo Instalacao do Network Monitor ===

echo Limpando cache...
npm cache clean --force

echo Removendo arquivos antigos...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo Configurando npm...
npm config set timeout 60000
npm config delete proxy
npm config delete https-proxy

echo Instalando dependencias...
npm install --legacy-peer-deps --no-optional --registry https://registry.npmjs.org/

echo Instalacao concluida!
pause
```

## 🚀 Alternativa: Versão Pré-compilada

Se os problemas persistirem, posso criar uma versão pré-compilada que não requer instalação de dependências:

### Opção A: Build Pronto
- Frontend já compilado
- Apenas executar o Electron
- Sem necessidade de `npm install`

### Opção B: Versão Portable
- Aplicativo empacotado
- Executável único
- Sem dependências externas

## 📞 Próximos Passos

1. **Tente a Solução 1** (Administrador) primeiro
2. **Se não funcionar**, use a **Solução 2** (Limpar e reinstalar)
3. **Se ainda houver problemas**, me informe e criarei uma versão pré-compilada

Qual solução você gostaria de tentar primeiro?

