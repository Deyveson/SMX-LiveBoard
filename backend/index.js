// SMX LiveBoard - Servidor Completo
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const logger = require('./utils/logger');
const HttpLogger = require('./utils/httpLogger');
// Configurações padrão do sistema
const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3002,
    METRICS_INTERVAL: process.env.METRICS_INTERVAL || 10000,
    PROCESSES_INTERVAL: process.env.PROCESSES_INTERVAL || 60000,
    SERVICES_INTERVAL: process.env.SERVICES_INTERVAL || 30000,
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_CLEANUP_DAYS: process.env.LOG_CLEANUP_DAYS || 7,
    MAX_HISTORY_POINTS: process.env.MAX_HISTORY_POINTS || 60,
    MAX_PROCESSES: process.env.MAX_PROCESSES || 10,
    MAX_SERVICES: process.env.MAX_SERVICES || 20
};

// Resolver caminho absoluto para evitar conflitos de capitalização
const servicesPath = path.resolve(__dirname, 'services');

// Importar serviços
let ProcessMonitoringService, TerminalService;
let LogsService, TelegramService, MonitorService, SSHService;

try {
    ProcessMonitoringService = require(path.join(servicesPath, 'processMonitoringService.js'));
    TerminalService = require(path.join(servicesPath, 'terminalService.js'));
    LogsService = require(path.join(servicesPath, 'logsService.js'));
    TelegramService = require(path.join(servicesPath, 'telegramService.js'));
    MonitorService = require(path.join(servicesPath, 'monitorService.js'));
    SSHService = require(path.join(servicesPath, 'sshService.js'));
} catch (error) {
    logger.error('Erro ao carregar serviços:', error.message);
    process.exit(1);
}

class SMXLiveBoardServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: { 
                origin: "*", 
                methods: ["GET", "POST"],
                credentials: true
            },
            // Configurações otimizadas para estabilidade de conexão
            pingTimeout: 30000,        // 30 segundos (reduzido)
            pingInterval: 20000,       // 20 segundos (sincronizado com frontend)
            upgradeTimeout: 10000,     // 10 segundos
            allowEIO3: true,           // Compatibilidade
            transports: ['websocket', 'polling'], // WebSocket primeiro
            // Configurações de heartbeat otimizadas
            heartbeatTimeout: 30000,   // 30 segundos (reduzido)
            heartbeatInterval: 20000,  // 20 segundos (sincronizado)
            // Configurações adicionais para limpeza
            allowUpgrades: true,
            perMessageDeflate: {
                threshold: 1024,
                concurrencyLimit: 10,
                memLevel: 7
            },
            // Aumentar buffer para evitar desconexões por dados grandes
            maxHttpBufferSize: 1e8, // 100MB (aumentado de 1MB)
            // Timeout para conexões inativas
            connectTimeout: 60000,
            // Configurações adicionais para estabilidade
            forceNew: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            maxReconnectionAttempts: 5,
            // Configurações específicas para evitar desconexões
            serveClient: false,        // Não servir cliente automaticamente
            cookie: false,            // Desabilitar cookies para evitar problemas
            // Configurações de transporte específicas
            transports: ['websocket', 'polling'],
            // Configurações de polling para fallback
            polling: {
                extraHeaders: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,POST',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            }
        });
        
        this.port = process.env.PORT || 3002;
        this.isProduction = process.env.NODE_ENV === 'production';
        
        // Inicializar logger HTTP personalizado
        this.httpLogger = new HttpLogger();
        this.httpLogger.startCacheCleanup();
        
        this.intervals = { metrics: null, processes: null, adaptive: null };
        this.lastMetricsSent = 0; // Throttling para evitar spam
        this.adaptiveConfig = {
            activeClients: 0,
            baseMetricsInterval: 10000,    // 10s base (MAIS CONSERVADOR)
            baseProcessesInterval: 45000,  // 45s base (MAIS CONSERVADOR)
            minMetricsInterval: 8000,      // 8s mínimo
            maxMetricsInterval: 20000,     // 20s máximo
            minProcessesInterval: 30000,   // 30s mínimo
            maxProcessesInterval: 90000    // 90s máximo
        };
        
        // Inicializar serviços essenciais primeiro
        try {
            this.monitorService = new MonitorService();
            // Log removido - inicialização silenciosa
        } catch (error) {
            logger.failure('Erro ao inicializar serviços essenciais', { error: error.message });
            throw error;
        }
        
        // Inicializar outros serviços de forma assíncrona
        this.initializeSecondaryServices();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
        this.startDataCollection();
    }

    // Inicializar serviços secundários de forma assíncrona
    async initializeSecondaryServices() {
        try {
            // Inicializar serviços não críticos em paralelo
            await Promise.all([
                this.initializeProcessMonitoring(),
                this.initializeTerminalService(),
                this.initializeLogsService(),
                this.initializeTelegramService()
            ]);
            
            // Log removido - inicialização silenciosa
        } catch (error) {
            logger.warn('Alguns serviços secundários falharam ao inicializar', { error: error.message });
            // Não parar o servidor por causa de serviços não críticos
        }
    }

    async initializeProcessMonitoring() {
        try {
            this.processMonitoring = new ProcessMonitoringService();
            // Log removido - inicialização silenciosa
        } catch (error) {
            logger.warn('Falha ao inicializar ProcessMonitoringService', { error: error.message });
        }
    }

    async initializeTerminalService() {
        try {
            this.terminalService = new TerminalService();
            // Log removido - inicialização silenciosa
        } catch (error) {
            logger.warn('Falha ao inicializar TerminalService', { error: error.message });
        }
    }

    async initializeLogsService() {
        try {
            this.logsService = new LogsService();
            
            // Integrar com MonitorService para logs reais (silencioso)
            if (this.monitorService) {
                // Logs de teste removidos para reduzir spam
            }
            
            // Log removido - inicialização silenciosa
        } catch (error) {
            logger.warn('Falha ao inicializar LogsService', { error: error.message });
        }
    }

    async initializeTelegramService() {
        try {
            this.telegramService = new TelegramService();
            
            // 🔒 TOKENS HARDCODED - CONFIGURE AQUI
            const botToken = 'SEU_TOKEN_AQUI';
            const chatId = 'SEU_CHAT_ID_AQUI';
            
            this.telegramService.configure(botToken, chatId);
            // Log removido - inicialização silenciosa
            
            // Configurar envio automático diário às 23h
            this.setupDailyTelegramReport();
            
        } catch (error) {
            logger.warn('Falha ao inicializar TelegramService', { error: error.message });
        }
    }

    // Configurar relatórios automáticos às 7h e 23h
    setupDailyTelegramReport() {
        const scheduleReport = (hour) => {
            const now = new Date();
            const nextReport = new Date(now);
            
            // Se já passou da hora hoje, agendar para amanhã
            if (now.getHours() >= hour) {
                nextReport.setDate(nextReport.getDate() + 1);
            }
            nextReport.setHours(hour, 0, 0, 0);
            
            const timeUntilReport = nextReport.getTime() - now.getTime();
            
            // Log removido - agendamento silencioso
            
            setTimeout(async () => {
                try {
                    await this.sendDailyReport();
                    // Agendar próximo relatório
                    scheduleReport(hour);
                } catch (error) {
                    logger.error('❌ Erro ao enviar relatório:', error.message);
                    // Tentar novamente em 1 hora
                    setTimeout(() => scheduleReport(hour), 60 * 60 * 1000);
                }
            }, timeUntilReport);
        };
        
        // Agendar relatórios para 7h e 23h
        scheduleReport(7);  // 07:00
        scheduleReport(23); // 23:00
    }

    // Enviar relatório diário
    async sendDailyReport() {
        try {
            if (!this.telegramService || !this.telegramService.isBotConfigured()) {
                logger.warn('⚠️ Telegram não configurado, pulando relatório diário');
                return;
            }

            logger.info('📊 Enviando relatório diário via Telegram...');
            
            // Obter dados atuais do sistema
            const systemData = await this.monitorService.getSystemInfo();
            
            // Criar mensagem de relatório diário
            const timestamp = new Date().toLocaleString('pt-BR');
            const uptime = this.formatUptime(process.uptime());
            
            let message = `📊 <b>RELATÓRIO DIÁRIO - SMX LiveBoard</b>\n\n`;
            message += `📅 <b>Data:</b> ${timestamp}\n`;
            message += `⏱️ <b>Uptime:</b> ${uptime}\n\n`;
            
            // Status do sistema
            message += `🖥️ <b>CPU:</b> ${systemData.cpu?.usage || 0}%\n`;
            message += `💾 <b>Memória:</b> ${systemData.memory?.usage || 0}%\n`;
            message += `💿 <b>Disco:</b> ${systemData.disk?.usage || 0}%\n\n`;
            
            // Top processos
            if (systemData.processes && systemData.processes.length > 0) {
                message += `🔝 <b>Top 3 Processos:</b>\n`;
                systemData.processes.slice(0, 3).forEach((proc, index) => {
                    message += `${index + 1}. ${proc.name} (${proc.cpu}% CPU)\n`;
                });
                message += `\n`;
            }
            
            // Estatísticas de logs se disponível
            if (this.logsService) {
                const logStats = this.logsService.getLogStats();
                message += `📋 <b>Logs (24h):</b>\n`;
                message += `• Total: ${logStats.total}\n`;
                message += `• Info: ${logStats.byLevel.INFO || 0}\n`;
                message += `• Warning: ${logStats.byLevel.WARNING || 0}\n`;
                message += `• Error: ${logStats.byLevel.ERROR || 0}\n`;
                message += `• Critical: ${logStats.byLevel.CRITICAL || 0}\n\n`;
            }
            
            message += `✅ <b>Sistema funcionando normalmente</b>`;
            
            // Enviar mensagem
            await this.telegramService.sendMessage(message);
            
            logger.success('✅ Relatório diário enviado com sucesso');
            
        } catch (error) {
            logger.error('❌ Erro ao enviar relatório diário:', error.message);
            throw error;
        }
    }

    // Formatar uptime
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    }

    // Calcular intervalo adaptativo baseado no número de clientes
    calculateAdaptiveInterval(baseInterval, minInterval, maxInterval) {
        const clientCount = this.adaptiveConfig.activeClients;
        
        if (clientCount === 0) {
            return maxInterval; // Máximo quando não há clientes
        } else if (clientCount === 1) {
            return baseInterval; // Base para 1 cliente
        } else if (clientCount <= 3) {
            return Math.max(minInterval, baseInterval * 0.7); // Mais rápido para poucos clientes
        } else {
            return Math.max(minInterval, baseInterval * 0.5); // Mais rápido para muitos clientes
        }
    }

    // Contar clientes únicos baseados no IP
    getUniqueClientsCount() {
        const connectedClients = new Set();
        
        this.io.sockets.sockets.forEach((socket) => {
            const clientIP = socket.handshake.address || socket.conn.remoteAddress;
            // Normalizar IP (remover IPv6 prefix se necessário)
            const normalizedIP = clientIP.replace(/^::ffff:/, '');
            connectedClients.add(normalizedIP);
        });
        
        return connectedClients.size;
    }

    // Atualizar contador de clientes ativos
    updateActiveClients() {
        const newCount = this.getUniqueClientsCount();
        const oldCount = this.adaptiveConfig.activeClients;
        
        this.adaptiveConfig.activeClients = newCount;
        
        // Atualizar contador de clientes (sem log)
    }

    // Reiniciar intervalos com novos valores adaptativos
    restartAdaptiveIntervals() {
        this.stopDataCollection();
        this.startDataCollection();
    }

    // Diagnosticar problemas de comunicação
    diagnoseCommunicationProblem(socket, bytesSent, bytesReceived) {
        const clientIP = socket.handshake.address || socket.conn.remoteAddress;
        const normalizedIP = clientIP.replace(/^::ffff:/, '');
        const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
        const transport = socket.conn.transport.name;
        const lastHeartbeat = socket._lastHeartbeat || 0;
        const timeSinceHeartbeat = Date.now() - lastHeartbeat;
        
        // Coletar informações de diagnóstico
        const diagnosis = {
            socketId: socket.id,
            clientIP: normalizedIP,
            transport: transport,
            userAgent: userAgent,
            bytesSent: bytesSent,
            bytesReceived: bytesReceived,
            timeSinceHeartbeat: timeSinceHeartbeat,
            connected: socket.connected,
            timestamp: new Date().toISOString()
        };
        
        // Analisar possíveis causas
        const possibleCauses = [];
        
        if (timeSinceHeartbeat > 60000) {
            possibleCauses.push('Cliente não está enviando heartbeat (possível problema no frontend)');
        }
        
        if (transport === 'polling') {
            possibleCauses.push('Usando polling em vez de WebSocket (possível problema de firewall/proxy)');
        }
        
        if (userAgent.includes('OPR')) {
            possibleCauses.push('Navegador Opera detectado (possível problema de compatibilidade)');
        }
        
        if (bytesReceived === 0) {
            possibleCauses.push('Cliente não está respondendo a nenhuma mensagem (possível problema de rede)');
        }
        
        if (bytesReceived < 50 && bytesSent > 5000) {
            possibleCauses.push('Comunicação muito unidirecional (possível problema de buffer ou processamento)');
        }
        
        // Log removido - diagnóstico silencioso
        
        // Tentar soluções automáticas
        if (timeSinceHeartbeat > 120000) {
            // Log removido - reconexão silenciosa
            socket.emit('force_reconnect', { reason: 'no_heartbeat', timestamp: Date.now() });
        }
        
        return diagnosis;
    }

    // Limpar conexões órfãs (sem heartbeat há muito tempo)
    cleanupOrphanedConnections() {
        const now = Date.now();
        const orphanedConnections = [];
        const allConnections = [];
        
        this.io.sockets.sockets.forEach((socket) => {
            const lastHeartbeat = socket._lastHeartbeat || 0;
            const timeSinceHeartbeat = now - lastHeartbeat;
            const clientIP = socket.handshake.address || socket.conn.remoteAddress;
            const normalizedIP = clientIP.replace(/^::ffff:/, '');
            
            allConnections.push({
                id: socket.id,
                clientIP: normalizedIP,
                connected: socket.connected,
                timeSinceHeartbeat: timeSinceHeartbeat,
                transport: socket.conn.transport.name
            });
            
            // Considerar órfã se não há heartbeat há mais de 90 segundos (reduzido de 2 minutos)
            if (timeSinceHeartbeat > 90000) {
                orphanedConnections.push({
                    socket: socket,
                    id: socket.id,
                    clientIP: normalizedIP,
                    timeSinceHeartbeat: timeSinceHeartbeat
                });
            }
        });
        
        // Log apenas se houver problemas
        if (allConnections.some(conn => conn.timeSinceHeartbeat > 60000)) {
            // Log removido - status silencioso
        }
        
        if (orphanedConnections.length > 0) {
            // Log removido - limpeza silenciosa
            
            orphanedConnections.forEach(conn => {
                conn.socket.disconnect(true);
            });
        }
    }

    // Configurar monitoramento de saúde da conexão
    setupConnectionHealthMonitoring(socket) {
        // Configurar timers de monitoramento
        socket._lastHeartbeat = Date.now();
        socket._heartbeatTimer = setInterval(() => {
            if (socket.connected) {
                const timeSinceLastHeartbeat = Date.now() - socket._lastHeartbeat;
                if (timeSinceLastHeartbeat > 25000) { // 25 segundos sem heartbeat
                    // Log removido - health check silencioso
                    socket.emit('health_check', { timestamp: Date.now() });
                }
            }
        }, 10000); // Verificar a cada 10 segundos (mais frequente)

        // Atualizar timestamp do heartbeat quando receber
        socket.on('heartbeat', (data) => {
            socket._lastHeartbeat = Date.now();
            // Log removido - heartbeat silencioso
            
            // Responder com acknowledgment
            socket.emit('heartbeat_ack', { 
                timestamp: Date.now(),
                clientTimestamp: data?.timestamp || null
            });
        });

        // Limpar timer quando socket desconectar
        socket.on('disconnect', () => {
            if (socket._heartbeatTimer) {
                clearInterval(socket._heartbeatTimer);
                delete socket._heartbeatTimer;
            }
        });
    }

    // Lidar com conexões duplicadas do mesmo cliente
    handleDuplicateConnections(newSocket, clientIP) {
        const existingConnections = [];
        
        // Encontrar todas as conexões existentes do mesmo IP
        this.io.sockets.sockets.forEach((socket) => {
            if (socket.id !== newSocket.id) {
                const existingIP = socket.handshake.address || socket.conn.remoteAddress;
                const normalizedExistingIP = existingIP.replace(/^::ffff:/, '');
                
                if (normalizedExistingIP === clientIP) {
                    existingConnections.push({
                        socket: socket,
                        id: socket.id,
                        transport: socket.conn.transport.name,
                        connected: socket.connected,
                        lastHeartbeat: socket._lastHeartbeat || 0
                    });
                }
            }
        });
        
        if (existingConnections.length > 0) {
            // Conexões duplicadas detectadas - fechar órfãs silenciosamente
            
            // Fechar conexões antigas que não estão respondendo
            existingConnections.forEach(conn => {
                const timeSinceHeartbeat = Date.now() - (conn.lastHeartbeat || 0);
                
                if (!conn.connected || timeSinceHeartbeat > 30000) {
                    conn.socket.disconnect(true);
                }
            });
        }
    }

    // Configurar diagnósticos de transporte
    setupTransportDiagnostics(socket) {
        const clientIP = socket.handshake.address || socket.conn.remoteAddress;
        const normalizedIP = clientIP.replace(/^::ffff:/, '');
        
        // Monitorar mudanças de transporte
        socket.conn.on('upgrade', () => {
            // Upgrade de transporte realizado
        });

        // Monitorar erros de transporte
        socket.conn.on('error', (error) => {
            logger.error(`❌ Erro de transporte: ${socket.id} (${normalizedIP}) - ${error.message}`, {
                socketId: socket.id,
                clientIP: normalizedIP,
                transport: socket.conn.transport.name,
                error: error.message,
                stack: error.stack
            });
        });

        // Monitorar fechamento de transporte
        socket.conn.on('close', (reason) => {
            // Fechamento de transporte detectado
        });

        // Monitorar dados enviados/recebidos para detectar problemas
        let bytesSent = 0;
        let bytesReceived = 0;
        
        socket.conn.on('packet', (packet) => {
            bytesReceived += JSON.stringify(packet).length;
        });

        const originalEmit = socket.emit;
        socket.emit = function(...args) {
            bytesSent += JSON.stringify(args).length;
            return originalEmit.apply(this, args);
        };

        // Monitorar estatísticas de comunicação
        socket._statsTimer = setInterval(() => {
            if (socket.connected) {
                // Monitorar problemas de comunicação e diagnosticar
                if (bytesReceived < 100 && bytesSent > 1000) {
                    this.diagnoseCommunicationProblem(socket, bytesSent, bytesReceived);
                }
            }
        }, 30000);

        // Limpar timer quando socket desconectar
        socket.on('disconnect', () => {
            if (socket._statsTimer) {
                clearInterval(socket._statsTimer);
                delete socket._statsTimer;
            }
        });
    }

    // Encurtar User Agent para logs
    shortenUserAgent(userAgent) {
        if (!userAgent || userAgent === 'Unknown') return 'Unknown';
        
        // Extrair navegador principal
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        if (userAgent.includes('Opera')) return 'Opera';
        
        // Se for muito longo, truncar
        if (userAgent.length > 30) {
            return userAgent.substring(0, 27) + '...';
        }
        
        return userAgent;
    }

    // Limpar recursos específicos de um socket
    cleanupSocketResources(socket) {
        try {
            // Fechar sessões de terminal associadas
            if (this.terminalService) {
                const sessionId = socket.id + '_terminal';
                this.terminalService.closeSession(sessionId);
            }
            
            // Parar monitoramento de logs em tempo real
            if (this.logsService) {
                this.logsService.stopRealTimeMonitoring(socket);
            }
            
            // Limpar todos os timers específicos do socket
            if (socket._cleanupTimer) {
                clearTimeout(socket._cleanupTimer);
                delete socket._cleanupTimer;
            }
            
            if (socket._heartbeatTimer) {
                clearInterval(socket._heartbeatTimer);
                delete socket._heartbeatTimer;
            }
            
            if (socket._statsTimer) {
                clearInterval(socket._statsTimer);
                delete socket._statsTimer;
            }
            
        } catch (error) {
            logger.warn(`Erro ao limpar recursos do socket ${socket.id}:`, error.message);
        }
    }

    setupMiddleware() {
        this.app.use(helmet({ contentSecurityPolicy: false }));
        this.app.use(compression({
            level: 6,
            threshold: 1024,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            }
        }));
        
        // Usar logger HTTP personalizado em vez do Morgan
        this.app.use(this.httpLogger.middleware());
        
        // Morgan apenas em desenvolvimento para logs adicionais (opcional)
        if (!this.isProduction && process.env.ENABLE_MORGAN === 'true') {
            this.app.use(morgan('dev'));
        }
        
        this.app.use(cors());
        this.app.use(express.json({ limit: '5mb' })); // Reduzido de 10mb
        this.app.use(express.urlencoded({ extended: true, limit: '5mb' }));
        
        // Arquivos estáticos com cache otimizado
        const staticOptions = {
            maxAge: this.isProduction ? '1d' : '0', // Cache em produção
            etag: true,
            lastModified: true,
            setHeaders: (res, path) => {
                // Cache específico para diferentes tipos de arquivo
                if (path.endsWith('.css') || path.endsWith('.js')) {
                    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora
                } else if (path.endsWith('.ico') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.svg')) {
                    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 dia
                    // Definir tipo MIME correto para SVG
                    if (path.endsWith('.svg')) {
                        res.setHeader('Content-Type', 'image/svg+xml');
                    }
                }
            }
        };
        
        this.app.use(express.static(path.join(__dirname, '..'), staticOptions));
        this.app.use('/assets', express.static(path.join(__dirname, '..', 'assets'), staticOptions));
        this.app.use('/js', express.static(path.join(__dirname, '..', 'js'), staticOptions));
        this.app.use('/styles', express.static(path.join(__dirname, '..', 'styles'), staticOptions));
    }

    setupRoutes() {
        // Rota principal
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'index.html'));
        });

        // APIs básicas
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        });

        this.app.get('/api/system/metrics', async (req, res) => {
            const startTime = Date.now();
            try {
                const metrics = await this.monitorService.getSystemInfo();
                const duration = Date.now() - startTime;
                
                // Log de performance para métricas
                logger.performance(`Métricas coletadas em ${duration}ms`, {
                    duration,
                    requestId: req.requestId,
                    endpoint: '/api/system/metrics'
                });
                
                res.json(metrics);
            } catch (error) {
                const duration = Date.now() - startTime;
                logger.error(`Erro ao coletar métricas: ${error.message}`, {
                    duration,
                    requestId: req.requestId,
                    endpoint: '/api/system/metrics',
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para estatísticas do cache
        this.app.get('/api/system/cache-stats', async (req, res) => {
            try {
                const cacheStats = this.monitorService.getCacheStats();
                res.json({
                    cache: cacheStats,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para limpar cache
        this.app.post('/api/system/clear-cache', async (req, res) => {
            try {
                const { cacheType = 'all' } = req.body;
                this.monitorService.clearCache(cacheType);
                res.json({ 
                    success: true, 
                    message: `Cache ${cacheType} limpo com sucesso`,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para estatísticas de performance
        this.app.get('/api/system/performance', async (req, res) => {
            try {
                const performanceStats = this.monitorService.getPerformanceStats();
                res.json(performanceStats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para resetar métricas de performance
        this.app.post('/api/system/reset-performance', async (req, res) => {
            try {
                this.monitorService.resetPerformanceMetrics();
                res.json({ 
                    success: true, 
                    message: 'Métricas de performance resetadas com sucesso',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para alertas de performance
        this.app.get('/api/system/performance-alerts', async (req, res) => {
            try {
                const alerts = this.monitorService.checkPerformanceAlerts();
                res.json({
                    alerts: alerts,
                    count: alerts.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para status das conexões WebSocket
        this.app.get('/api/system/connections', async (req, res) => {
            try {
                const connections = [];
                const uniqueClients = new Set();
                const now = Date.now();
                
                this.io.sockets.sockets.forEach((socket) => {
                    const clientIP = socket.handshake.address || socket.conn.remoteAddress;
                    const normalizedIP = clientIP.replace(/^::ffff:/, '');
                    uniqueClients.add(normalizedIP);
                    
                    const lastHeartbeat = socket._lastHeartbeat || 0;
                    const timeSinceHeartbeat = now - lastHeartbeat;
                    
                    connections.push({
                        socketId: socket.id,
                        clientIP: normalizedIP,
                        transport: socket.conn.transport.name,
                        connected: socket.connected,
                        connectedAt: socket.handshake.time,
                        userAgent: socket.handshake.headers['user-agent'] || 'Unknown',
                        lastHeartbeat: lastHeartbeat,
                        timeSinceHeartbeat: timeSinceHeartbeat,
                        timeSinceHeartbeatSeconds: Math.round(timeSinceHeartbeat / 1000)
                    });
                });
                
                res.json({
                    totalConnections: connections.length,
                    uniqueClients: uniqueClients.size,
                    connections: connections,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para forçar limpeza de conexões órfãs
        this.app.post('/api/system/cleanup-connections', async (req, res) => {
            try {
                this.cleanupOrphanedConnections();
                
                res.json({
                    success: true,
                    message: 'Limpeza de conexões órfãs executada',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para diagnóstico de problemas de comunicação
        this.app.get('/api/system/communication-diagnostics', async (req, res) => {
            try {
                const diagnostics = [];
                const now = Date.now();
                
                this.io.sockets.sockets.forEach((socket) => {
                    const clientIP = socket.handshake.address || socket.conn.remoteAddress;
                    const normalizedIP = clientIP.replace(/^::ffff:/, '');
                    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
                    const transport = socket.conn.transport.name;
                    const lastHeartbeat = socket._lastHeartbeat || 0;
                    const timeSinceHeartbeat = now - lastHeartbeat;
                    
                    // Calcular estatísticas de comunicação
                    let bytesSent = 0;
                    let bytesReceived = 0;
                    
                    // Simular cálculo de bytes (em produção seria mais preciso)
                    const connectionTime = now - socket.handshake.time;
                    const estimatedBytesSent = Math.floor(connectionTime / 1000) * 200; // Estimativa
                    const estimatedBytesReceived = Math.floor(connectionTime / 1000) * 50; // Estimativa
                    
                    const diagnostic = {
                        socketId: socket.id,
                        clientIP: normalizedIP,
                        transport: transport,
                        userAgent: userAgent,
                        connected: socket.connected,
                        connectionTime: Math.floor(connectionTime / 1000) + 's',
                        timeSinceHeartbeat: Math.floor(timeSinceHeartbeat / 1000) + 's',
                        estimatedBytesSent: estimatedBytesSent,
                        estimatedBytesReceived: estimatedBytesReceived,
                        healthStatus: timeSinceHeartbeat < 30000 ? 'HEALTHY' : 
                                     timeSinceHeartbeat < 60000 ? 'WARNING' : 'CRITICAL',
                        possibleIssues: []
                    };
                    
                    // Identificar possíveis problemas
                    if (timeSinceHeartbeat > 60000) {
                        diagnostic.possibleIssues.push('Sem heartbeat há muito tempo');
                    }
                    if (transport === 'polling') {
                        diagnostic.possibleIssues.push('Usando polling (possível problema de firewall)');
                    }
                    if (userAgent.includes('OPR')) {
                        diagnostic.possibleIssues.push('Navegador Opera (possível problema de compatibilidade)');
                    }
                    if (estimatedBytesReceived < estimatedBytesSent * 0.1) {
                        diagnostic.possibleIssues.push('Comunicação muito unidirecional');
                    }
                    
                    diagnostics.push(diagnostic);
                });
                
                res.json({
                    success: true,
                    totalConnections: diagnostics.length,
                    diagnostics: diagnostics,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/processes', async (req, res) => {
            const startTime = Date.now();
            try {
                if (!this.processMonitoring) {
                    logger.warn('ProcessMonitoringService não inicializado', {
                        requestId: req.requestId,
                        endpoint: '/api/processes'
                    });
                    return res.status(503).json({ error: 'ProcessMonitoringService ainda não inicializado' });
                }
                const processes = await this.processMonitoring.getTopProcesses();
                const duration = Date.now() - startTime;
                
                logger.performance(`Processos coletados em ${duration}ms`, {
                    duration,
                    requestId: req.requestId,
                    endpoint: '/api/processes',
                    processCount: processes.length
                });
                
                res.json(processes);
            } catch (error) {
                const duration = Date.now() - startTime;
                logger.error(`Erro ao coletar processos: ${error.message}`, {
                    duration,
                    requestId: req.requestId,
                    endpoint: '/api/processes',
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });


        // Terminal API
        this.app.post('/api/terminal/execute', async (req, res) => {
            try {
                if (!this.terminalService) {
                    return res.status(503).json({ error: 'TerminalService ainda não inicializado' });
                }
                const { command } = req.body;
                if (!command || typeof command !== 'string') {
                    return res.status(400).json({ error: 'Comando é obrigatório' });
                }
                if (!this.terminalService.isCommandSafe(command)) {
                    return res.status(400).json({ error: 'Comando não permitido por segurança' });
                }
                const result = await this.terminalService.executeCommand(command);
                res.json(result);
            } catch (error) {
                logger.error('Erro ao executar comando:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Terminal - criar sessão
        this.app.post('/api/terminal/session', async (req, res) => {
            try {
                if (!this.terminalService) {
                    return res.status(503).json({ error: 'TerminalService ainda não inicializado' });
                }
                const sessionId = 'rest_' + Date.now();
                const session = this.terminalService.createSession(sessionId);
                res.json({ sessionId, status: 'created' });
            } catch (error) {
                logger.error('Erro ao criar sessão terminal:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Terminal - autocompletar
        this.app.get('/api/terminal/autocomplete', async (req, res) => {
            try {
                if (!this.terminalService) {
                    return res.status(503).json({ error: 'TerminalService ainda não inicializado' });
                }
                const { q: partialCommand, type = 'command' } = req.query;
                if (!partialCommand) {
                    return res.status(400).json({ error: 'Parâmetro q é obrigatório' });
                }
                
                let suggestions = [];
                if (type === 'command') {
                    suggestions = this.terminalService.getCommandSuggestions(partialCommand);
                } else if (type === 'path') {
                    suggestions = await this.terminalService.getPathSuggestions(partialCommand);
                }
                
                res.json({ suggestions, partialCommand, type });
            } catch (error) {
                logger.error('Erro ao obter sugestões:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Terminal - fechar sessão
        this.app.delete('/api/terminal/session/:sessionId', async (req, res) => {
            try {
                if (!this.terminalService) {
                    return res.status(503).json({ error: 'TerminalService ainda não inicializado' });
                }
                const { sessionId } = req.params;
                const result = this.terminalService.closeSession(sessionId);
                res.json(result);
            } catch (error) {
                logger.error('Erro ao fechar sessão:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Logs API
        this.app.get('/api/logs', async (req, res) => {
            try {
                if (!this.logsService) {
                    return res.status(503).json({ error: 'LogsService ainda não inicializado' });
                }
                const { level, source, search, startDate, endDate, limit = 100, offset = 0 } = req.query;
                const options = { level, source, search, startDate, endDate, limit: parseInt(limit), offset: parseInt(offset) };
                const result = this.logsService.getLogs(options);
                res.json(result);
            } catch (error) {
                logger.error('Erro ao obter logs:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/logs/stats', async (req, res) => {
            try {
                if (!this.logsService) {
                    return res.status(503).json({ error: 'LogsService ainda não inicializado' });
                }
                const stats = this.logsService.getLogStats();
                res.json(stats);
            } catch (error) {
                logger.error('Erro ao obter estatísticas de logs:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/logs/export', async (req, res) => {
            try {
                if (!this.logsService) {
                    return res.status(503).json({ error: 'LogsService ainda não inicializado' });
                }
                const { format = 'json', ...options } = req.body;
                const exportData = await this.logsService.exportLogs(format, options);
                
                res.setHeader('Content-Type', format === 'json' ? 'application/json' : 
                             format === 'csv' ? 'text/csv' : 'text/plain');
                res.setHeader('Content-Disposition', `attachment; filename="smx-logs-${new Date().toISOString().split('T')[0]}.${format}"`);
                res.send(exportData);
            } catch (error) {
                logger.error('Erro ao exportar logs:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.delete('/api/logs/clear', async (req, res) => {
            try {
                if (!this.logsService) {
                    return res.status(503).json({ error: 'LogsService ainda não inicializado' });
                }
                const { daysToKeep = 30 } = req.body;
                const result = await this.logsService.clearOldLogs(daysToKeep);
                res.json({ 
                    success: true, 
                    message: `${result.removed} logs removidos, ${result.remaining} mantidos`,
                    ...result
                });
            } catch (error) {
                logger.error('Erro ao limpar logs:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Telegram API - Apenas APIs de uso (configuração removida - tokens hardcoded)
        this.app.get('/api/telegram/status', async (req, res) => {
            try {
                if (!this.telegramService) {
                    return res.status(503).json({ error: 'TelegramService ainda não inicializado' });
                }
                const isConfigured = this.telegramService.isBotConfigured();
                res.json({ 
                    configured: isConfigured,
                    message: isConfigured ? 'Bot configurado (tokens hardcoded)' : 'Bot não configurado'
                });
            } catch (error) {
                logger.error('Erro ao verificar status do Telegram:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/telegram/send', async (req, res) => {
            try {
                if (!this.telegramService) {
                    return res.status(503).json({ error: 'TelegramService ainda não inicializado' });
                }
                
                if (!this.telegramService.isBotConfigured()) {
                    return res.status(400).json({ error: 'Bot não configurado' });
                }

                const { message } = req.body;
                
                if (!message) {
                    return res.status(400).json({ error: 'Mensagem é obrigatória' });
                }

                const result = await this.telegramService.sendMessage(message);
                res.json({ 
                    success: true, 
                    message: 'Mensagem enviada com sucesso',
                    messageId: result.message_id
                });
            } catch (error) {
                logger.error('Erro ao enviar mensagem:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/telegram/alert', async (req, res) => {
            try {
                if (!this.telegramService) {
                    return res.status(503).json({ error: 'TelegramService ainda não inicializado' });
                }
                
                if (!this.telegramService.isBotConfigured()) {
                    return res.status(400).json({ error: 'Bot não configurado' });
                }

                const { alertType, data, severity = 'INFO' } = req.body;
                
                if (!alertType || !data) {
                    return res.status(400).json({ error: 'Tipo de alerta e dados são obrigatórios' });
                }

                let result;
                
                if (alertType === 'SYSTEM_STATUS') {
                    // Enviar relatório de status completo
                    result = await this.telegramService.sendStatusReport(data);
                } else if (alertType === 'PROCESSES') {
                    // Enviar alerta de processos
                    const message = `⚙️ <b>TOP PROCESSOS</b>\n\n` +
                        `📊 <b>Hostname:</b> ${data.hostname}\n\n` +
                        data.processes.map((proc, index) => 
                            `${index + 1}. <b>${proc.name}</b>\n` +
                            `   • CPU: ${proc.cpu}%\n` +
                            `   • Memória: ${proc.memory}MB\n` +
                            `   • PID: ${proc.pid}`
                        ).join('\n\n');
                    
                    result = await this.telegramService.sendMessage(message);
                } else {
                    // Enviar alerta específico
                    result = await this.telegramService.sendSystemAlert(alertType, data, severity);
                }

                res.json({ 
                    success: true, 
                    message: 'Alerta enviado com sucesso',
                    messageId: result.message_id
                });
            } catch (error) {
                logger.error('Erro ao enviar alerta:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/telegram/test', async (req, res) => {
            try {
                if (!this.telegramService) {
                    return res.status(503).json({ error: 'TelegramService ainda não inicializado' });
                }
                
                if (!this.telegramService.isBotConfigured()) {
                    return res.status(400).json({ error: 'Bot não configurado' });
                }

                const result = await this.telegramService.testConnection();
                res.json(result);
            } catch (error) {
                logger.error('Erro ao testar conexão:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // ===== ROTAS SSH =====
        
        // Testar conexão SSH
        this.app.post('/api/ssh/test', async (req, res) => {
            try {
                const result = await SSHService.testConnection(req.body);
                res.json(result);
            } catch (error) {
                logger.error('Erro ao testar conexão SSH:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Conectar SSH
        this.app.post('/api/ssh/connect', async (req, res) => {
            try {
                const result = await SSHService.connect(req.body);
                res.json(result);
            } catch (error) {
                logger.error('Erro ao conectar SSH:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Desconectar SSH
        this.app.post('/api/ssh/disconnect', async (req, res) => {
            try {
                const connectionId = SSHService.generateConnectionId(req.body);
                const result = await SSHService.disconnect(connectionId);
                res.json(result);
            } catch (error) {
                logger.error('Erro ao desconectar SSH:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Listar conexões SSH ativas
        this.app.get('/api/ssh/connections', async (req, res) => {
            try {
                const connections = SSHService.getActiveConnections();
                res.json({
                    success: true,
                    connections,
                    count: connections.length
                });
            } catch (error) {
                logger.error('Erro ao listar conexões SSH:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            // Log detalhado de conexão para diagnóstico
            const clientIP = socket.handshake.address || socket.conn.remoteAddress;
            const normalizedIP = clientIP.replace(/^::ffff:/, '');
            const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
            const transport = socket.conn.transport.name;
            
            // Verificar e limpar conexões duplicadas do mesmo cliente
            this.handleDuplicateConnections(socket, normalizedIP);
            
            // Log de conexão WebSocket
            logger.websocket(`Nova conexão estabelecida`, {
                socketId: socket.id,
                clientIP: normalizedIP,
                transport: transport,
                userAgent: this.shortenUserAgent(userAgent),
                totalConnections: this.io.sockets.sockets.size
            });
            
            // Atualizar contador de clientes
            this.updateActiveClients();
            
            // Configurar monitoramento de saúde da conexão
            this.setupConnectionHealthMonitoring(socket);
            
            // Configurar diagnósticos de transporte
            this.setupTransportDiagnostics(socket);
            
            // Enviar dados iniciais
            this.sendInitialData(socket);

            // Evento de ping/pong para monitoramento
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: Date.now() });
            });

            // Evento de heartbeat personalizado
            socket.on('heartbeat', () => {
                socket.emit('heartbeat_ack', { timestamp: Date.now() });
            });

            // Eventos para solicitação imediata de dados após reconexão
            socket.on('request_initial_data', async () => {
                try {
                    const metrics = await this.monitorService.getBasicSystemInfo();
                    socket.emit('initial:data', metrics);
                } catch (error) {
                    logger.error(`❌ Erro ao enviar dados iniciais para ${socket.id}:`, error.message);
                }
            });

            socket.on('request_current_metrics', async () => {
                try {
                    const metrics = await this.monitorService.getSystemInfo();
                    socket.emit('system:metrics', metrics);
                } catch (error) {
                    logger.error(`❌ Erro ao enviar métricas atuais para ${socket.id}:`, error.message);
                }
            });

            socket.on('request_current_processes', async () => {
                try {
                    const processesData = await this.monitorService.getProcessesOnly(5);
                    socket.emit('processes:update', processesData.processes);
                } catch (error) {
                    logger.error(`❌ Erro ao enviar processos atuais para ${socket.id}:`, error.message);
                }
            });

            // Terminal interativo - criar sessão
            socket.on('terminal:create', async (data) => {
                try {
                    if (!this.terminalService) {
                        socket.emit('terminal:error', { error: 'TerminalService ainda não inicializado' });
                        return;
                    }
                    
                    const sessionId = socket.id + '_terminal';
                    const session = this.terminalService.createSession(sessionId);
                    
                    // Configurar callbacks para output em tempo real
                    session.onOutput = (output) => {
                        socket.emit('terminal:output', { output, sessionId });
                    };
                    
                    session.onError = (error) => {
                        socket.emit('terminal:error', { error, sessionId });
                    };
                    
                    socket.emit('terminal:created', { sessionId });
                } catch (error) {
                    logger.error(`❌ Terminal create error for ${socket.id}:`, error.message);
                    socket.emit('terminal:error', { error: error.message });
                }
            });

            // Terminal interativo - enviar comando
            socket.on('terminal:command', async (data) => {
                try {
                    if (!this.terminalService) {
                        socket.emit('terminal:error', { error: 'TerminalService ainda não inicializado' });
                        return;
                    }
                    
                    const { command, sessionId } = data;
                    if (!sessionId) {
                        // Fallback para comando único
                        const result = await this.terminalService.executeCommand(command);
                        socket.emit('terminal:response', result);
                        return;
                    }
                    
                    this.terminalService.sendToSession(sessionId, command);
                    socket.emit('terminal:command_sent', { command, sessionId });
                } catch (error) {
                    logger.error(`❌ Terminal command error for ${socket.id}:`, error.message);
                    socket.emit('terminal:error', { error: error.message });
                }
            });

            // Terminal - autocompletar
            socket.on('terminal:autocomplete', async (data) => {
                try {
                    if (!this.terminalService) {
                        socket.emit('terminal:error', { error: 'TerminalService ainda não inicializado' });
                        return;
                    }
                    
                    const { partialCommand, type = 'command' } = data;
                    let suggestions = [];
                    
                    if (type === 'command') {
                        suggestions = this.terminalService.getCommandSuggestions(partialCommand);
                    } else if (type === 'path') {
                        suggestions = await this.terminalService.getPathSuggestions(partialCommand);
                    }
                    
                    socket.emit('terminal:suggestions', { suggestions, partialCommand, type });
                } catch (error) {
                    logger.error(`❌ Terminal autocomplete error for ${socket.id}:`, error.message);
                    socket.emit('terminal:error', { error: error.message });
                }
            });

            // Terminal - fechar sessão
            socket.on('terminal:close', async (data) => {
                try {
                    if (!this.terminalService) {
                        return;
                    }
                    
                    const { sessionId } = data;
                    if (sessionId) {
                        this.terminalService.closeSession(sessionId);
                        socket.emit('terminal:closed', { sessionId });
                    }
                } catch (error) {
                    logger.error(`❌ Terminal close error for ${socket.id}:`, error.message);
                }
            });

            // Logs - solicitar logs
            socket.on('logs:request', async (data) => {
                try {
                    if (!this.logsService) {
                        socket.emit('logs:error', { error: 'LogsService ainda não inicializado' });
                        return;
                    }
                    
                    const options = data || {};
                    const result = this.logsService.getLogs(options);
                    socket.emit('logs:data', result);
                } catch (error) {
                    logger.error(`❌ Logs request error for ${socket.id}:`, error.message);
                    socket.emit('logs:error', { error: error.message });
                }
            });

            // Logs - solicitar estatísticas
            socket.on('logs:stats', async () => {
                try {
                    if (!this.logsService) {
                        socket.emit('logs:error', { error: 'LogsService ainda não inicializado' });
                        return;
                    }
                    
                    const stats = this.logsService.getLogStats();
                    socket.emit('logs:stats', stats);
                } catch (error) {
                    logger.error(`❌ Logs stats error for ${socket.id}:`, error.message);
                    socket.emit('logs:error', { error: error.message });
                }
            });

            // Logs - iniciar monitoramento em tempo real
            socket.on('logs:start_realtime', async () => {
                try {
                    if (!this.logsService) {
                        socket.emit('logs:error', { error: 'LogsService ainda não inicializado' });
                        return;
                    }
                    
                    // Iniciar monitoramento em tempo real para este socket
                    this.logsService.startRealTimeMonitoring(socket);
                    socket.emit('logs:realtime_started', { message: 'Monitoramento em tempo real iniciado' });
                } catch (error) {
                    logger.error(`❌ Logs realtime start error for ${socket.id}:`, error.message);
                    socket.emit('logs:error', { error: error.message });
                }
            });


            // Tratamento de erros de conexão
            socket.on('error', (error) => {
                logger.error(`❌ Socket error for ${socket.id}:`, error.message);
            });

            // Eventos de desconexão
            // ===== EVENTOS SSH =====
            
            // Conectar SSH via Socket.IO
            socket.on('ssh-connect', async (data) => {
                try {
                    const result = await SSHService.connect(data, socket);
                    socket.emit('ssh-connection-status', {
                        success: result.success,
                        connected: result.success,
                        status: result.success ? 'Conectado' : 'Erro na conexão',
                        connectionId: result.connectionId,
                        error: result.error
                    });
                } catch (error) {
                    logger.error('Erro ao conectar SSH via Socket:', error);
                    socket.emit('ssh-connection-status', {
                        success: false,
                        connected: false,
                        status: 'Erro na conexão',
                        error: error.message
                    });
                }
            });

            // Executar comando SSH
            socket.on('ssh-command', async (data) => {
                try {
                    const { command, connection } = data;
                    const connectionId = SSHService.generateConnectionId(connection);
                    
                    if (!SSHService.isConnectionActive(connectionId)) {
                        socket.emit('ssh-error', {
                            error: 'Conexão SSH não está ativa'
                        });
                        return;
                    }

                    await SSHService.executeCommand(connectionId, command, socket);
                } catch (error) {
                    logger.error('Erro ao executar comando SSH:', error);
                    socket.emit('ssh-error', {
                        error: error.message
                    });
                }
            });

            // Desconectar SSH
            socket.on('ssh-disconnect', async (data) => {
                try {
                    const connectionId = SSHService.generateConnectionId(data);
                    const result = await SSHService.disconnect(connectionId);
                    
                    socket.emit('ssh-connection-status', {
                        success: result.success,
                        connected: false,
                        status: 'Desconectado',
                        message: result.message,
                        error: result.error
                    });
                } catch (error) {
                    logger.error('Erro ao desconectar SSH:', error);
                    socket.emit('ssh-connection-status', {
                        success: false,
                        connected: false,
                        status: 'Erro ao desconectar',
                        error: error.message
                    });
                }
            });

            socket.on('disconnect', (reason) => {
                // Limpar recursos específicos do socket
                this.cleanupSocketResources(socket);
                
                // Atualizar contador de clientes
                this.updateActiveClients();
                
                // Log detalhado baseado no motivo da desconexão
                const clientIP = socket.handshake.address || socket.conn.remoteAddress;
                const normalizedIP = clientIP.replace(/^::ffff:/, '');
                const userAgent = this.shortenUserAgent(socket.handshake.headers['user-agent']);
                const connectionDuration = Date.now() - socket.handshake.time;
                
                const disconnectContext = {
                    socketId: socket.id,
                    clientIP: normalizedIP,
                    userAgent: userAgent,
                    reason: reason,
                    connectionDuration: Math.round(connectionDuration / 1000) + 's',
                    totalConnections: this.io.sockets.sockets.size
                };
                
                if (reason === 'transport close') {
                    logger.websocket(`Cliente desconectado - Fechamento de transporte`, disconnectContext);
                } else if (reason === 'transport error') {
                    logger.warn(`Cliente desconectado - Erro de transporte`, disconnectContext);
                } else if (reason === 'ping timeout') {
                    logger.warn(`Cliente desconectado - Timeout de ping`, disconnectContext);
                } else if (reason === 'client namespace disconnect') {
                    // Log silencioso para desconexões normais
                } else if (reason === 'server namespace disconnect') {
                    // Log silencioso para desconexões do servidor
                } else {
                    logger.websocket(`Cliente desconectado - ${reason}`, disconnectContext);
                }
            });

            // Evento de reconexão
            socket.on('reconnect', (attemptNumber) => {
                // Log removido para limpar terminal
            });
        });

        // Log de eventos do servidor Socket.IO
        this.io.engine.on('connection_error', (err) => {
            logger.error('Erro de conexão Socket.IO:', err.message);
        });

        // Monitorar erros de upgrade
        this.io.engine.on('upgrade_error', (err) => {
            logger.warn('Erro de upgrade WebSocket:', err.message);
        });

        // Monitorar erros de polling
        this.io.engine.on('polling_error', (err) => {
            logger.warn('Erro de polling:', err.message);
        });
    }

    async sendInitialData(socket) {
        try {
            // Usar coleta básica para inicialização rápida
            const metrics = await this.monitorService.getBasicSystemInfo();
            
            // Estrutura consistente com system:metrics
            const initialData = {
                ...metrics, // cpu, memory, network, disk, time, osInfo, processes
            };
            
            socket.emit('initial:data', initialData);
            
            // Enviar dados completos em background após 2 segundos
            setTimeout(async () => {
                try {
                    const fullMetrics = await this.monitorService.getSystemInfo();
                    socket.emit('system:metrics', fullMetrics);
                } catch (error) {
                    console.warn(`❌ Erro ao enviar dados completos para ${socket.id}:`, error.message);
                }
            }, 2000);

            // Enviar processos em background após 3 segundos
            setTimeout(async () => {
                try {
                    const processesData = await this.monitorService.getProcessesOnly(5);
                    socket.emit('processes:update', processesData.processes);
                } catch (error) {
                    console.warn(`❌ Erro ao enviar processos para ${socket.id}:`, error.message);
                }
            }, 3000);
            
        } catch (error) {
            logger.error(`❌ Erro ao enviar dados iniciais para ${socket.id}:`, error.message);
            socket.emit('initial:error', { 
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    startDataCollection() {
        this.stopDataCollection();
        
        // Calcular intervalos adaptativos
        const metricsInterval = this.calculateAdaptiveInterval(
            this.adaptiveConfig.baseMetricsInterval,
            this.adaptiveConfig.minMetricsInterval,
            this.adaptiveConfig.maxMetricsInterval
        );
        
        const processesInterval = this.calculateAdaptiveInterval(
            this.adaptiveConfig.baseProcessesInterval,
            this.adaptiveConfig.minProcessesInterval,
            this.adaptiveConfig.maxProcessesInterval
        );
        
        // Log removido - intervalos silenciosos
        
        // Coletar métricas do sistema com intervalo adaptativo
        this.intervals.metrics = setInterval(async () => {
            try {
                const metrics = await this.monitorService.getSystemInfo();
                
                // Log de métricas apenas se LogsService estiver disponível
                if (this.logsService) {
                    // Log de alertas de CPU
                    if (metrics.cpu && metrics.cpu.usage > 80) {
                        this.logsService.warning(`CPU alta: ${metrics.cpu.usage.toFixed(1)}%`, 'CPU', {
                            usage: metrics.cpu.usage,
                            cores: metrics.cpu.cores
                        });
                    }
                    
                    // Log de alertas de memória
                    if (metrics.memory && metrics.memory.usage > 85) {
                        this.logsService.warning(`Memória alta: ${metrics.memory.usage.toFixed(1)}%`, 'MEMORY', {
                            usage: metrics.memory.usage,
                            used: metrics.memory.used,
                            total: metrics.memory.total
                        });
                    }
                    
                    // Log de alertas de disco
                    if (metrics.disk && metrics.disk.usage > 90) {
                        this.logsService.warning(`Disco cheio: ${metrics.disk.usage.toFixed(1)}%`, 'DISK', {
                            usage: metrics.disk.usage,
                            used: metrics.disk.used,
                            total: metrics.disk.total
                        });
                    }
                }
                
                // Verificar se há clientes conectados antes de enviar
                if (this.getUniqueClientsCount() > 0) {
                    // Throttling: evitar envios muito frequentes
                    const now = Date.now();
                    if (now - this.lastMetricsSent > 5000) { // Mínimo 5s entre envios
                        this.io.emit('system:metrics', metrics);
                        this.lastMetricsSent = now;
                    }
                }
            } catch (error) {
                logger.error('Erro ao coletar métricas do sistema', {
                    error: error.message,
                    stack: error.stack,
                    type: 'metrics_collection'
                });
                
                // Log de erro se LogsService estiver disponível
                if (this.logsService) {
                    this.logsService.error(`Erro ao coletar métricas: ${error.message}`, 'MONITOR');
                }
            }
        }, metricsInterval);


        // Coletar processos com intervalo adaptativo
        this.intervals.processes = setInterval(async () => {
            try {
                // Usar o método otimizado do MonitorService
                const processesData = await this.monitorService.getProcessesOnly(5);
                // Verificar se há clientes conectados antes de enviar
                if (this.getUniqueClientsCount() > 0) {
                    // Enviar dados no formato correto para o frontend
                    this.io.emit('processes:update', processesData.processes);
                }
            } catch (error) {
                logger.error('Erro ao coletar processos do sistema', {
                    error: error.message,
                    stack: error.stack,
                    type: 'processes_collection'
                });
                
                // Enviar dados vazios em caso de erro para manter o frontend funcionando
                if (this.getUniqueClientsCount() > 0) {
                    this.io.emit('processes:update', { 
                        list: [],
                        totals: { cpu: 0, memory: 0, count: 0 }
                    });
                }
            }
        }, processesInterval);

        // Timer para ajustar intervalos dinamicamente a cada 30 segundos
        this.intervals.adaptive = setInterval(() => {
            const currentClients = this.getUniqueClientsCount();
            if (currentClients !== this.adaptiveConfig.activeClients) {
                this.adaptiveConfig.activeClients = currentClients;
                this.restartAdaptiveIntervals();
            }
        }, 30000);

        // Timer para limpeza de conexões órfãs a cada 60 segundos
        this.intervals.cleanup = setInterval(() => {
            this.cleanupOrphanedConnections();
        }, 60000);
        
        // Coleta de dados iniciada
    }
    
    
    stopDataCollection() {
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        this.intervals = { metrics: null, processes: null, adaptive: null, cleanup: null };
    }

    start() {
        this.server.listen(this.port, '0.0.0.0', () => {
            // Banner retro gaming épico
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ███████╗███╗   ███╗██╗  ██╗    ██╗     ██╗██╗   ██╗███████╗ ║
║  ██╔════╝████╗ ████║╚██╗██╔╝    ██║     ██║██║   ██║██╔════╝ ║
║  ███████╗██╔████╔██║ ╚███╔╝     ██║     ██║██║   ██║█████╗   ║
║  ╚════██║██║╚██╔╝██║ ██╔██╗     ██║     ██║╚██╗ ██╔╝██╔══╝   ║
║  ███████║██║ ╚═╝ ██║██╔╝ ██╗    ███████╗██║ ╚████╔╝ ███████╗ ║
║  ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝    ╚══════╝╚═╝  ╚═══╝  ╚══════╝ ║
║                                                              ║
║  SYSTEM INITIALIZED - READY TO MONITOR                      ║
║  HIGH SCORE: 999999999                                       ║
║  LEVEL: MAXIMUM SECURITY                                     ║
║  STATUS: OPERATIONAL                                         ║
╚══════════════════════════════════════════════════════════════╝
            `);
            
            logger.startup(`SMX LiveBoard rodando na porta ${this.port}`, { port: this.port });
            // Logs de URLs removidos - informações no banner
        });
    }
}

// Inicializar servidor
let server;
try {
    server = new SMXLiveBoardServer();
    server.start();
} catch (error) {
    logger.failure('Erro fatal ao inicializar servidor', { error: error.message });
    process.exit(1);
}

// Graceful shutdown
let isShuttingDown = false;

function gracefulShutdown(signal) {
    if (isShuttingDown) {
        console.log('┌─────────────────────────────────────────┐');
        console.log('│  🛑 Forçando encerramento...           │');
        console.log('│  ⚠️  Sistema sendo finalizado!         │');
        console.log('└─────────────────────────────────────────┘');
        process.exit(1);
        return;
    }
    
    isShuttingDown = true;
    
    // Banner retro de encerramento
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ███████╗███╗   ███╗██╗  ██╗    ██╗     ██╗██╗   ██╗███████╗ ║
║  ██╔════╝████╗ ████║╚██╗██╔╝    ██║     ██║██║   ██║██╔════╝ ║
║  ███████╗██╔████╔██║ ╚███╔╝     ██║     ██║██║   ██║█████╗   ║
║  ╚════██║██║╚██╔╝██║ ██╔██╗     ██║     ██║╚██╗ ██╔╝██╔══╝   ║
║  ███████║██║ ╚═╝ ██║██╔╝ ██╗    ███████╗██║ ╚████╔╝ ███████╗ ║
║  ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝    ╚══════╝╚═╝  ╚═══╝  ╚══════╝ ║
║                                                              ║
║  SYSTEM SHUTTING DOWN                                        ║
║  STOPPING DATA COLLECTION                                    ║
║  CLOSING WEBSOCKET SERVER                                    ║
║  FINALIZING DASHBOARD                                        ║
║  SAVING CONFIGURATIONS                                       ║
║  SHUTDOWN COMPLETE                                           ║
╚══════════════════════════════════════════════════════════════╝
    `);
    
    logger.shutdown(`Recebido ${signal}, encerrando servidor...`, { signal });
    
    if (server) {
        try {
            // Parar coleta de dados
            server.stopDataCollection();
            
            // Fechar Socket.IO
            if (server.io) {
                server.io.close();
            }
            
            // Fechar servidor HTTP
            if (server.server) {
                server.server.close(() => {
                    // Banner retro de sucesso
                    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ███████╗███╗   ███╗██╗  ██╗    ██╗     ██╗██╗   ██╗███████╗ ║
║  ██╔════╝████╗ ████║╚██╗██╔╝    ██║     ██║██║   ██║██╔════╝ ║
║  ███████╗██╔████╔██║ ╚███╔╝     ██║     ██║██║   ██║█████╗   ║
║  ╚════██║██║╚██╔╝██║ ██╔██╗     ██║     ██║╚██╗ ██╔╝██╔══╝   ║
║  ███████║██║ ╚═╝ ██║██╔╝ ██╗    ███████╗██║ ╚████╔╝ ███████╗ ║
║  ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝    ╚══════╝╚═╝  ╚═══╝  ╚══════╝ ║
║                                                              ║
║  SYSTEM SHUTDOWN COMPLETE                                    ║
║  THANK YOU FOR USING SMX LIVEBOARD                          ║
║  RESTART WHEN YOU NEED IT                                    ║
║  HIGH SCORE: PERFECT SHUTDOWN                               ║
╚══════════════════════════════════════════════════════════════╝
                    `);
                    
                    logger.success('Servidor encerrado com sucesso');
                    process.exit(0);
                });
                
                // Timeout de segurança - forçar encerramento após 3 segundos
                setTimeout(() => {
                    logger.warn('Timeout no encerramento - forçando saída');
                    process.exit(1);
                }, 3000);
            } else {
                process.exit(0);
            }
        } catch (error) {
            logger.failure('Erro durante encerramento', { error: error.message });
            process.exit(1);
        }
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Tratar erros não capturados
process.on('uncaughtException', (error) => {
    logger.failure('Erro não capturado', { 
        error: error.message, 
        stack: error.stack 
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.failure('Promise rejeitada não tratada', { 
        reason: reason.toString(),
        promise: promise.toString()
    });
    process.exit(1);
});