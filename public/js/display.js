document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const titleEl = document.getElementById('carousel-title');
    const dateEl = document.getElementById('carousel-date');
    const descriptionEl = document.getElementById('carousel-description');
    const imageEl = document.getElementById('carousel-image');
    const imagePlaceholder = document.querySelector('.image-placeholder');
    const qrCodeEl = document.getElementById('qr-code');
    const progressBarEl = document.getElementById('progress-bar');
    const descriptionArea = document.querySelector('.description-scroll-area');
    const screenId = document.body.dataset.screenId;

    // --- Estado da Aplicação ---
    let content = initialContent;
    let currentIndex = 0;
    let carouselIntervalId = null;
    let progressIntervalId = null;
    let scrollAnimationId = null;

    const qrCodeInstance = new QRCode(qrCodeEl, {
        width: 150,
        height: 150,
        correctLevel: QRCode.CorrectLevel.H
    });

     function connectWebSocket() {
        // Constrói a URL do WebSocket a partir da URL da página
        // Troca http -> ws e https -> wss
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('Conectado ao servidor WebSocket.');
        };

        socket.onmessage = (event) => {
            // Verifica se a mensagem recebida é o nosso comando
            if (event.data === 'REFRESH') {
                console.log('Comando de refresh recebido! Recarregando a página...');
                window.location.reload();
            }
        };

        socket.onclose = () => {
            console.log('Conexão WebSocket perdida. Tentando reconectar em 5 segundos...');
            // Tenta reconectar após 5 segundos se a conexão for perdida
            setTimeout(connectWebSocket, 5000);
        };

        socket.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            socket.close(); // Isso acionará o 'onclose' para tentar reconectar
        };
    }

    // Inicia a conexão WebSocket
    connectWebSocket();


    function updateDisplay() {
        // Para qualquer animação/intervalo anterior
        if (progressIntervalId) clearInterval(progressIntervalId);
        if (scrollAnimationId) cancelAnimationFrame(scrollAnimationId);

        if (!content || content.length === 0) {
            titleEl.textContent = 'Nenhum conteúdo para exibir.';
            dateEl.textContent = '';
            descriptionEl.innerHTML = 'Verifique a conexão ou as fontes de conteúdo.';
            imageEl.style.display = 'none';
            imagePlaceholder.style.display = 'block';
            imagePlaceholder.textContent = 'Sem conteúdo';
            qrCodeEl.style.display = 'none';
            return;
        }

        const item = content[currentIndex];

        // Atualiza textos
        titleEl.textContent = item.titulo;
        dateEl.textContent = item.data;
        descriptionEl.innerHTML = item.descricao; // Usamos innerHTML para renderizar o <i>

        // Reseta a posição da rolagem
        descriptionArea.scrollTop = 0;

        // Atualiza imagem
        imageEl.style.display = 'none';
        imagePlaceholder.style.display = 'block';
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

        // Atualiza QR Code
        if (item.link) {
            qrCodeInstance.makeCode(item.link);
            qrCodeEl.style.display = 'block';
        } else {
            qrCodeEl.style.display = 'none';
        }

        // Reinicia a barra de progresso e a rolagem suave
        startProgressBar();
        setTimeout(startSmoothScroll, 4000); // Delay de 4s antes de começar a rolar
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

        if (scrollHeight <= clientHeight) {
            return; // Não precisa rolar
        }

        const scrollDistance = scrollHeight - clientHeight;
        const scrollDuration = config.carouselInterval - 4000; // Tempo restante do slide
        let startTime = null;

        function animateScroll(currentTime) {
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;
            
            const progress = Math.min(elapsedTime / scrollDuration, 1);
            descriptionArea.scrollTop = progress * scrollDistance;
            
            if (progress < 1) {
                scrollAnimationId = requestAnimationFrame(animateScroll);
            }
        }
        scrollAnimationId = requestAnimationFrame(animateScroll);
    }
    
    function nextItem() {
        currentIndex = (currentIndex + 1) % content.length;
        updateDisplay();
    }

    function startCarousel() {
        if (carouselIntervalId) clearInterval(carouselIntervalId);
        if (content && content.length > 0) {
            updateDisplay();
            carouselIntervalId = setInterval(nextItem, config.carouselInterval);
        } else {
            updateDisplay(); // Mostra mensagem de "sem conteúdo"
        }
    }
    
async function fetchAndUpdateContent() {
    console.log(`Buscando atualizações de conteúdo para a tela ${screenId}...`);
    try {
        const response = await fetch(`/api/content/${screenId}`);
        if (!response.ok) throw new Error('Falha na resposta da API');
        
        // ATUALIZADO: Extrai o conteúdo e a nova config da resposta
        const data = await response.json();
        const newContent = data.content;
        const newConfig = data.config;

        const isContentDifferent = JSON.stringify(content) !== JSON.stringify(newContent);
        
        // Compara a config atual com a nova
        const isConfigDifferent = config.carouselInterval !== newConfig.carouselInterval;

        if (isContentDifferent || isConfigDifferent) {
            console.log("Conteúdo ou configuração atualizados. Reiniciando carrossel.");
            content = newContent;
            
            if(isConfigDifferent) {
                console.log(`Intervalo do carrossel alterado de ${config.carouselInterval} para ${newConfig.carouselInterval}`);
                config.carouselInterval = newConfig.carouselInterval; // Atualiza a config local
            }
            
            currentIndex = 0;
            startCarousel(); // Reinicia o carrossel com os novos dados/config
        } else {
             console.log("Nenhum conteúdo novo encontrado.");
        }

    } catch (error) {
        console.error("Erro ao buscar atualizações:", error);
    }
}
    // --- Inicialização ---
    startCarousel();
    
    // Configura a busca periódica por novo conteúdo
    setInterval(fetchAndUpdateContent, config.contentUpdateInterval);
    
    // Adicione a biblioteca qrcode.js na pasta public/js
    // Baixe de: https://github.com/davidshimjs/qrcodejs/blob/master/qrcode.min.js
});