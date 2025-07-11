document.addEventListener('DOMContentLoaded', () => {
    // Seletores para os novos elementos de info
    const screensCountEl = document.getElementById('screens-count');
    const serverTimeEl = document.getElementById('server-time');
    const updateTimerEl = document.getElementById('update-timer');

    let serverTime = null;
    let timeDifference = 0;
    let updateIntervalSeconds = 0;
    let countdownIntervalId = null;

    // --- 1. CONEXÃO WEBSOCKET PARA CONTAGEM DE TELAS ---
    function connectDashboardWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Conecta na URL especial para dashboards
        const socket = new WebSocket(`${wsProtocol}//${window.location.host}/dashboard-ws`);

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'active_screens_count') {
                    screensCountEl.textContent = data.count;
                }
            } catch (error) {
                console.error('Erro ao processar mensagem do WebSocket:', error);
            }
        };

        socket.onclose = () => {
            setTimeout(connectDashboardWebSocket, 5000); // Tenta reconectar
        };
    }

    // --- 2. RELÓGIO E TIMER DE ATUALIZAÇÃO ---
    async function fetchServerInfo() {
        try {
            const response = await fetch('/api/server-info');
            const data = await response.json();

            serverTime = new Date(data.serverTime);
            updateIntervalSeconds = data.updateInterval;
            
            // Calcula a diferença entre o relógio do servidor e o do cliente
            timeDifference = serverTime.getTime() - new Date().getTime();

            // Inicia os timers
            startClocks();
        } catch (error) {
            console.error('Erro ao buscar informações do servidor:', error);
        }
    }

    function startClocks() {
        // Limpa intervalos antigos para evitar múltiplos timers
        if (countdownIntervalId) clearInterval(countdownIntervalId);

        // Função que roda a cada segundo
        countdownIntervalId = setInterval(() => {
            // Estima a hora atual do servidor
            const estimatedServerTime = new Date(new Date().getTime() + timeDifference);
            serverTimeEl.textContent = estimatedServerTime.toLocaleTimeString('pt-BR');

            // Lógica do contador regressivo
            const secondsSinceEpoch = Math.floor(estimatedServerTime.getTime() / 1000);
            const secondsUntilUpdate = updateIntervalSeconds - (secondsSinceEpoch % updateIntervalSeconds);
            
            const minutes = Math.floor(secondsUntilUpdate / 60);
            const seconds = secondsUntilUpdate % 60;

            updateTimerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    // --- 3. INICIALIZAÇÃO ---
    connectDashboardWebSocket();
    fetchServerInfo();
});