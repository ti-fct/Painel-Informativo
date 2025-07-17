document.addEventListener('DOMContentLoaded', () => {
    // =======================================================
    // 1. INICIALIZAÇÃO DE VARIÁVEIS (A PARTIR DO EJS)
    // =======================================================
    let content = initialData.content;
    let config = initialData.config;
    let currentIndex = 0;
    const screenId = initialData.screenId;

    let carouselIntervalId = null;
    let progressIntervalId = null;
    let scrollAnimationId = null;

    // =======================================================
    // 2. SELETORES DE ELEMENTOS DO DOM
    // =======================================================
    // ALTERAÇÃO: Selecionamos os novos contêineres
    const carouselWrapper = document.querySelector('.carousel-wrapper');
    const emptyStateContainer = document.getElementById('empty-state-container');

    const titleEl = document.getElementById('carousel-title');
    const dateEl = document.getElementById('carousel-date');
    const descriptionEl = document.getElementById('carousel-description');
    const imageEl = document.getElementById('carousel-image');
    const imagePlaceholder = document.querySelector('.image-placeholder');
    const qrCodeEl = document.getElementById('qr-code');
    const progressBarEl = document.getElementById('progress-bar');
    const descriptionArea = document.querySelector('.description-scroll-area');
    const bodyEl = document.body;

    // =======================================================
    // 3. INSTÂNCIAS E FUNÇÕES
    // =======================================================
    const qrCodeInstance = new QRCode(qrCodeEl, {
        width: 120,
        height: 120,
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
        
        // ALTERAÇÃO: Lógica de tela vazia simplificada
        if (!content || content.length === 0) {
            // Mostra a mensagem de tela vazia e esconde o carrossel
            carouselWrapper.style.display = 'none';
            emptyStateContainer.style.display = 'flex'; // 'flex' ativa o alinhamento central do CSS
            return;
        }

        // Garante que o estado visual esteja correto se houver conteúdo
        carouselWrapper.style.display = 'flex'; // 'flex' é o display padrão do wrapper
        emptyStateContainer.style.display = 'none';


        // Lógica para o layout dinâmico
        if (bodyEl.dataset.layout === 'dynamic') {
            const itemForLayout = content[currentIndex];
            bodyEl.classList.remove('layout-a-active', 'layout-b-active');

            if (itemForLayout.tipo === 'noticia') {
                bodyEl.classList.add('layout-a-active');
            } else {
                bodyEl.classList.add('layout-b-active');
            }
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
        // O updateDisplay agora gerencia o que mostrar (carrossel ou tela vazia)
        updateDisplay(); 
        
        // Só inicia o intervalo se houver conteúdo
        if (content && content.length > 0) {
            carouselIntervalId = setInterval(nextItem, config.carouselInterval);
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