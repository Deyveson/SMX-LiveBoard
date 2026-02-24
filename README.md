#  SMX LiveBoard
<p align="center">
  <img src="assets/logo.png" width="150" />
</p>

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://web.dev/progressive-web-apps/)
[![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange.svg)](package.json)

> **Dashboard de monitoramento de sistema em tempo real** com interface web moderna, design futurista e funcionalidades avançadas para administradores de sistema e desenvolvedores.

## 📸 Screenshots

![SMX LiveBoard Dashboard](https://via.placeholder.com/800x400/1a1a2e/ffffff?text=SMX+LiveBoard+Dashboard)
*Interface principal com métricas em tempo real*

![Terminal Integrado](https://via.placeholder.com/800x300/16213e/ffffff?text=Terminal+Integrado)
*Terminal integrado para execução de comandos*

![Conexões SSH](https://via.placeholder.com/800x300/0f3460/ffffff?text=Conex%C3%B5es+SSH)
*Gerenciamento de conexões SSH remotas*

## 🚀 Características Principais

### 📊 **Monitoramento em Tempo Real**
- **CPU**: Uso, temperatura, frequência, cores
- **Memória**: RAM, swap, cache, buffers
- **Disco**: Espaço, I/O, velocidade de leitura/escrita
- **Rede**: Tráfego, conexões, interfaces
- **Processos**: Lista completa com filtros e busca
- **Sistema**: Uptime, usuários, versão do OS

### 🖥️ **Interface Moderna**
- **Design futurista** com tema escuro
- **Responsiva** para desktop, tablet e mobile
- **Gráficos interativos** com Chart.js
- **Atualizações em tempo real** via WebSocket
- **PWA** - Instalável como app nativo
- **Temas** (dark/light mode)

### ⚡ **Funcionalidades Avançadas**
- **Terminal integrado** para execução de comandos
- **Conexões SSH** para servidores remotos
- **Notificações Telegram** para alertas
- **Sistema de logs** estruturado e avançado
- **Exportação de dados** em JSON/CSV
- **Configurações personalizáveis**

### 🔧 **Recursos Técnicos**
- **Cache inteligente** para otimização
- **Throttling** para evitar sobrecarga
- **Intervalos adaptativos** baseados na performance
- **Sistema de fallback** para alta disponibilidade
- **Logs estruturados** com níveis configuráveis

## 🛠️ Stack Tecnológica

### **Backend**
- **Node.js 18+** - Runtime JavaScript
- **Express.js** - Framework web
- **Socket.IO** - Comunicação em tempo real
- **SystemInformation** - Coleta de dados do sistema
- **SSH2** - Conexões SSH seguras
- **Morgan** - Logging HTTP
- **Helmet** - Segurança
- **CORS** - Cross-origin resource sharing

### **Frontend**
- **HTML5** - Estrutura semântica
- **CSS3** - Estilos modernos com variáveis
- **JavaScript ES6+** - Lógica da aplicação
- **Chart.js** - Gráficos interativos
- **WebSocket** - Comunicação em tempo real
- **PWA** - Service Worker e Manifest

### **Ferramentas**
- **Nodemon** - Desenvolvimento

## 📋 Pré-requisitos

- **Node.js 18+** ([Download](https://nodejs.org/))
- **NPM** (vem com Node.js)
- **Git** ([Download](https://git-scm.com/))
- **Sistema Operacional**: Windows 10+, macOS 10.15+, Ubuntu 18.04+

## ⚡ Instalação Rápida

### 1. **Clone o Repositório**
```bash
git clone https://github.com/mathsilva7717/SMX-LiveBoard.git
cd SMX-LiveBoard
```

### 2. **Instale as Dependências**
```bash
npm install
```

### 3. **Inicie o Servidor**
```bash
npm start
```

### 4. **Acesse no Navegador**
```
http://localhost:3002
```

## 🎯 Uso Detalhado

### **Dashboard Principal**
1. **Métricas do Sistema**: Visualize CPU, memória, disco e rede em tempo real
2. **Gráficos Interativos**: Clique nos gráficos para detalhes
3. **Filtros**: Use os filtros para focar em métricas específicas
4. **Exportação**: Clique em "Exportar" para baixar dados

### **Terminal Integrado**
1. **Acesse a aba "Terminal"**
2. **Digite comandos** como em um terminal normal
3. **Execute scripts** e comandos do sistema
4. **Visualize saída** em tempo real

### **Conexões SSH**
1. **Configure conexão** na aba "SSH"
2. **Adicione servidor**: IP, porta, usuário, senha/chave
3. **Conecte** e execute comandos remotamente
4. **Gerencie múltiplas conexões**

### **Notificações Telegram**
1. **Configure bot** no Telegram
2. **Adicione token** nas configurações
3. **Defina alertas** para métricas específicas
4. **Receba notificações** em tempo real

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
npm start              # Inicia servidor de produção
npm run dev            # Modo desenvolvimento com nodemon

# Electron (Desktop)
npm run electron       # Inicia app desktop
npm run electron:dev   # Modo desenvolvimento

# Build e Distribuição
npm run build          # Build do projeto
npm run build:win      # Build para Windows
npm run build:mac      # Build para macOS
npm run build:linux    # Build para Linux
npm run build:portable # Build portável Windows
npm run dist           # Build completo + distribuição

# Testes
npm test               # Executa testes (em desenvolvimento)
```

## 📁 Estrutura do Projeto

```
SMX-LiveBoard/
├── 📁 backend/                    # Servidor Node.js
│   ├── 📁 services/              # Serviços principais
│   │   ├── 📄 monitorService.js  # Monitoramento do sistema
│   │   ├── 📄 sshService.js      # Conexões SSH
│   │   ├── 📄 telegramService.js # Notificações Telegram
│   │   ├── 📄 terminalService.js # Terminal integrado
│   │   └── 📄 logsService.js     # Sistema de logs
│   ├── 📁 utils/                 # Utilitários
│   │   ├── 📄 logger.js          # Sistema de logging
│   │   └── 📄 httpLogger.js      # Logs HTTP
│   ├── 📁 logs/                  # Arquivos de log
│   ├── 📄 index.js               # Servidor principal
│   └── 📄 config.json            # Configurações
├── 📁 js/                        # Frontend JavaScript
│   ├── 📄 app.js                 # Aplicação principal
│   ├── 📄 logs.js                # Gerenciamento de logs
│   ├── 📄 ssh.js                 # Interface SSH
│   └── 📄 pwa-install.js         # Instalação PWA
├── 📁 styles/                    # Estilos CSS
│   ├── 📄 main.css               # Estilos principais
│   └── 📄 pwa-modal.css          # Modal PWA
├── 📁 assets/                    # Recursos estáticos
│   ├── 📄 favicon.svg            # Favicon
│   ├── 📄 icon-*.svg             # Ícones PWA
│   └── 📄 ...                    # Outros ícones
├── 📄 index.html                 # Página principal
├── 📄 manifest.json              # Manifest PWA
├── 📄 sw.js                      # Service Worker
├── 📄 browserconfig.xml          # Configuração IE/Edge
├── 📄 package.json               # Dependências e scripts
└── 📄 README.md                  # Este arquivo
```

## 🔧 Configuração Avançada

### **Arquivo de Configuração** (`backend/config.json`)

```json
{
  "processMonitoring": {
    "maxHistoryPoints": 20,        // Pontos de histórico
    "defaultLimit": 10,            // Limite padrão de processos
    "updateInterval": 5000,        // Intervalo de atualização (ms)
    "fallbackEnabled": true        // Sistema de fallback
  },
  "systemInformation": {
    "timeout": 10000,              // Timeout para coleta (ms)
    "retries": 3                   // Tentativas de retry
  },
  "logging": {
    "level": "info",               // Nível de log (debug, info, warn, error)
    "enableFileLogging": true      // Logs em arquivo
  }
}
```

### **Variáveis de Ambiente** (`.env`)

```bash
# Servidor
PORT=3002
NODE_ENV=production

# Telegram
TELEGRAM_BOT_TOKEN=seu_token_aqui
TELEGRAM_CHAT_ID=seu_chat_id_aqui

# SSH
SSH_TIMEOUT=30000
SSH_RETRIES=3

# Logs
LOG_LEVEL=info
LOG_FILE_PATH=./logs/system.log
```

**⚠️ Importante**: 
- Copie o arquivo `env.example` para `.env`
- **NUNCA** commite o arquivo `.env` no Git
- Mantenha seus tokens seguros

## 📡 APIs Disponíveis

### **Sistema**
- `GET /api/system/metrics` - Métricas do sistema
- `GET /api/system/info` - Informações do sistema
- `GET /api/system/uptime` - Tempo de atividade

### **Processos**
- `GET /api/processes` - Lista de processos
- `GET /api/processes/:pid` - Processo específico
- `POST /api/processes/:pid/kill` - Finalizar processo

### **Logs**
- `GET /api/logs` - Logs do sistema
- `GET /api/logs/:level` - Logs por nível
- `DELETE /api/logs` - Limpar logs

### **Terminal**
- `POST /api/terminal/execute` - Executar comando
- `GET /api/terminal/history` - Histórico de comandos

### **SSH**
- `POST /api/ssh/connect` - Conectar SSH
- `POST /api/ssh/execute` - Executar comando SSH
- `DELETE /api/ssh/disconnect` - Desconectar SSH

### **Telegram**
- `POST /api/telegram/send` - Enviar mensagem
- `GET /api/telegram/status` - Status da conexão

## 🚀 Roadmap de Desenvolvimento

O SMX LiveBoard está em constante evolução! Consulte nosso [Roadmap](ROADMAP.md) para ver as próximas funcionalidades:

### **Fase 1: Multi-Host** 🚀
- Monitoramento de múltiplos servidores
- Dashboard centralizado
- Comparação entre hosts

### **Fase 1.5: Melhorias Core** 🎨
- Interface mais responsiva
- Temas (dark/light mode)
- Configurações avançadas

### **Fase 2: App Desktop** 🖥️
- Aplicativo Electron
- Notificações nativas
- Tray icon

### **Fase 3: App Mobile** 📱
- App React Native
- Notificações push
- Widgets

### **Fase 4: Extensões** 🌐
- Extensões de navegador
- Widget na nova aba
- Badge com status

### **Fase 5: API Pública** 🔌
- API REST completa
- Webhooks
- SDK para JavaScript

## 🤝 Contribuindo

Contribuições são muito bem-vindas! O SMX LiveBoard é um projeto open source e precisa da sua ajuda para crescer.

### **Como Contribuir**

1. **Fork** o projeto
2. **Clone** seu fork: `git clone https://github.com/SEU_USUARIO/SMX-LiveBoard.git`
3. **Crie** uma branch: `git checkout -b feature/nova-feature`
4. **Desenvolva** sua feature
5. **Teste** suas alterações
6. **Commit** seguindo o padrão: `git commit -m "feat: adiciona nova funcionalidade"`
7. **Push** para sua branch: `git push origin feature/nova-feature`
8. **Abra** um Pull Request

### **Padrões de Código**

- **JavaScript**: Use ES6+ e async/await
- **CSS**: Use classes semânticas e variáveis CSS
- **Commits**: Use conventional commits (feat, fix, docs, style, refactor, test)
- **Nomes de arquivos**: Use kebab-case (ex: `user-service.js`)
- **Funções**: Use camelCase (ex: `getUserData()`)

### **Primeiros Passos**

Procurando por onde começar? Procure por issues marcadas com:
- `good first issue` - Ideal para iniciantes
- `help wanted` - Precisa de ajuda
- `documentation` - Melhorias na documentação

📖 **[Guia completo de contribuição →](CONTRIBUTING.md)**

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para detalhes.

```
MIT License

Copyright (c) 2025 Matheus Silva

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🆘 Suporte e Contato

### **Desenvolvedor Principal**
- **Nome**: Matheus Silva
- **Email**: [matheus.silva1097@gmail.com](mailto:matheus.silva1097@gmail.com)
- **Telefone**: [+55 13 99709-6178](https://wa.me/5513997096178)
- **GitHub**: [@mathsilva7717](https://github.com/mathsilva7717)
- **LinkedIn**: [Matheus Silva](https://www.linkedin.com/in/mathsilvass)

### **Canais de Suporte**
- **GitHub Issues**: Para bugs e sugestões
- **GitHub Discussions**: Para ideias e discussões
- **Email**: Suporte direto por email
- **WhatsApp**: Suporte rápido por mensagem

### **Documentação**
- **[Guia de Contribuição](CONTRIBUTING.md)** - Como contribuir
- **[Roadmap](ROADMAP.md)** - Próximas funcionalidades
- **[Sistema de Coleta](SYSTEM_COLLECTION_README.md)** - Arquitetura técnica

## 🙏 Agradecimentos

### **Bibliotecas e Ferramentas**
- [**systeminformation**](https://github.com/sebastian-hofmann/systeminformation) - Coleta de dados do sistema
- [**Socket.IO**](https://socket.io/) - Comunicação em tempo real
- [**Express.js**](https://expressjs.com/) - Framework web
- [**Chart.js**](https://www.chartjs.org/) - Gráficos interativos
- [**SSH2**](https://github.com/mscdex/ssh2) - Conexões SSH

### **Comunidade**
- **Contribuidores** que ajudam a melhorar o projeto
- **Usuários** que reportam bugs e sugerem melhorias
- **Comunidade open source** pelo suporte e inspiração

---

## 🌟 **Star o Projeto**

Se o SMX LiveBoard foi útil para você, considere dar uma ⭐ no GitHub! Isso ajuda muito o projeto a crescer e chegar a mais pessoas.

## 🔄 **Atualizações**

Mantenha-se atualizado com as últimas funcionalidades:
- **Watch** o repositório no GitHub
- **Follow** [@mathsilva7717](https://github.com/mathsilva7717) para updates
- **Subscribe** nas discussions para novidades

---

**Desenvolvido por [Matheus Silva](https://github.com/mathsilva7717)**

*SMX LiveBoard - Monitoramento de sistema feito simples e poderoso* 🚀
