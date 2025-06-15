document.addEventListener('DOMContentLoaded', () => {
    // =======================================================
    // 1. INICIALIZAÇÃO DE VARIÁVEIS (A PARTIR DO EJS)
    // =======================================================
    // A variável 'initialData' é criada pelo EJS e está disponível globalmente.
    // Agora, usamos essa única fonte de verdade para configurar o script.
    
    // Variáveis que podem mudar durante a execução
    let content = initialData.content;
    let config = initialData.config;
    let currentIndex = 0;

    // Constantes
    const screenId = initialData.screenId;

    // Variáveis de controle de animação
    let carouselIntervalId = null;
    let progressIntervalId = null;
    let scrollAnimationId = null;

    // =======================================================
    // 2. SELETORES DE ELEMENTOS DO DOM
    // =======================================================
    const titleEl = document.getElementById('carousel-title');
    const dateEl = document.getElementById('carousel-date');
    const descriptionEl = document.getElementById('carousel-description');
    const imageEl = document.getElementById('carousel-image');
    const imagePlaceholder = document.querySelector('.image-placeholder');
    const qrCodeEl = document.getElementById('qr-code');
    const progressBarEl = document.getElementById('progress-bar');
    const descriptionArea = document.querySelector('.description-scroll-area');
    //const headerTitleEl = document.querySelector('.main-header h1');
    // Atualiza o título principal da página
    //headerTitleEl.textContent = initialData.screenName;

    // =======================================================
    // 3. INSTÂNCIAS E FUNÇÕES
    // =======================================================
    const qrCodeInstance = new QRCode(qrCodeEl, {
        width: 150,
        height: 150,
        correctLevel: QRCode.CorrectLevel.H
    });

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => console.log('Conectado ao servidor WebSocket.');
        socket.onmessage = (event) => {
            if (event.data === 'REFRESH') {
                console.log('Comando de refresh recebido! Recarregando a página...');
                window.location.reload();
            }
        };
        socket.onclose = () => {
            console.log('Conexão WebSocket perdida. Tentando reconectar em 5 segundos...');
            setTimeout(connectWebSocket, 5000);
        };
        socket.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            socket.close();
        };
    }

    function updateDisplay() {
        if (progressIntervalId) clearInterval(progressIntervalId);
        if (scrollAnimationId) cancelAnimationFrame(scrollAnimationId);

        if (!content || content.length === 0) {
            titleEl.textContent = 'Nenhum conteúdo para exibir.';
            dateEl.textContent = '';
            descriptionEl.innerHTML = 'Verifique as configurações ou a conexão.';
            imageEl.style.display = 'none';
            imagePlaceholder.style.display = 'block';
            imagePlaceholder.textContent = 'Sem conteúdo';
            qrCodeEl.style.display = 'none';
            return;
        }

        const item = content[currentIndex];
        titleEl.textContent = item.titulo;
        dateEl.textContent = item.data;
        descriptionEl.innerHTML = item.descricao;
        descriptionArea.scrollTop = 0;

        imagePlaceholder.style.display = 'block';
        imageEl.style.display = 'none';

        if (item.url_imagem) {
            imagePlaceholder.textContent = 'Carregando imagem...';
            imageEl.src = item.url_imagem;
            imageEl.onload = () => {
                imageEl.style.display = 'block';
                imagePlaceholder.style.display = 'none';
            };
            imageEl.onerror = () => {
                imagePlaceholder.textContent = 'Erro ao carregar imagem';
            };
        } else {
            imagePlaceholder.textContent = 'Sem imagem disponível';
        }

        if (item.link) {
            qrCodeInstance.makeCode(item.link);
            qrCodeEl.style.display = 'block';
        } else {
            qrCodeEl.style.display = 'none';
        }

        startProgressBar();
        setTimeout(startSmoothScroll, 4000);
    }

    function startProgressBar() {
        progressBarEl.style.transition = 'none';
        progressBarEl.style.width = '0%';
        let startTime = Date.now();
        progressIntervalId = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const progress = (elapsedTime / config.carouselInterval) * 100;
            progressBarEl.style.transition = 'width 0.1s linear';
            progressBarEl.style.width = `${Math.min(progress, 100)}%`;
        }, 100);
    }

    function startSmoothScroll() {
        const scrollHeight = descriptionArea.scrollHeight;
        const clientHeight = descriptionArea.clientHeight;
        if (scrollHeight <= clientHeight) return;

        const scrollDistance = scrollHeight - clientHeight;
        const scrollDuration = config.carouselInterval - 4000;
        let startTime = null;

        function animateScroll(currentTime) {
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / scrollDuration, 1);
            descriptionArea.scrollTop = progress * scrollDistance;
            if (progress < 1) scrollAnimationId = requestAnimationFrame(animateScroll);
        }
        scrollAnimationId = requestAnimationFrame(animateScroll);
    }

    function nextItem() {
        if (!content || content.length === 0) return;
        currentIndex = (currentIndex + 1) % content.length;
        updateDisplay();
    }

    function startCarousel() {
        if (carouselIntervalId) clearInterval(carouselIntervalId);
        if (content && content.length > 0) {
            updateDisplay();
            carouselIntervalId = setInterval(nextItem, config.carouselInterval);
        } else {
            updateDisplay();
        }
    }
    
    async function fetchAndUpdateContent() {
        console.log(`Buscando atualizações para a tela ${screenId}...`);
        try {
            const response = await fetch(`/api/content/${screenId}`);
            if (!response.ok) throw new Error('Falha na resposta da API');
            
            const newData = await response.json();
            
            const isContentDifferent = JSON.stringify(content) !== JSON.stringify(newData.content);
            const isConfigDifferent = config.carouselInterval !== newData.config.carouselInterval;

            if (isContentDifferent || isConfigDifferent) {
                console.log("Conteúdo ou configuração foram atualizados. Reiniciando carrossel.");
                content = newData.content;
                if (isConfigDifferent) {
                    console.log(`Intervalo do carrossel alterado para ${newData.config.carouselInterval}ms`);
                    config.carouselInterval = newData.config.carouselInterval;
                }
                currentIndex = 0;
                startCarousel();
            } else {
                console.log("Nenhum conteúdo ou configuração nova encontrada.");
            }
        } catch (error) {
            console.error("Erro ao buscar atualizações:", error);
        }
    }

    // =======================================================
    // 4. EXECUÇÃO INICIAL
    // =======================================================
    connectWebSocket();
    startCarousel();
    setInterval(fetchAndUpdateContent, config.contentUpdateInterval);
});