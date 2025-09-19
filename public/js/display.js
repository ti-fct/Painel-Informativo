document.addEventListener('DOMContentLoaded', () => {
    // =======================================================
    // 1. INICIALIZAÇÃO DE VARIÁVEIS E ESTADO
    // =======================================================
    let content = initialData.content;
    let config = initialData.config;
    let currentIndex = 0;
    const screenId = initialData.screenId;

    let carouselIntervalId = null;
    let progressIntervalId = null;
    let scrollAnimationId = null;
    let clockIntervalId = null;

    // =======================================================
    // 2. SELETORES DE ELEMENTOS DO DOM
    // =======================================================
    const bodyEl = document.body;

    const carouselWrapper = document.querySelector('.carousel-wrapper');
    const calendarWrapper = document.querySelector('.calendar-wrapper');
    const emptyStateContainer = document.getElementById('empty-state-container');

    // -- Seletores para layouts A e B
    const titleEl = document.getElementById('carousel-title');
    const dateEl = document.getElementById('carousel-date');
    const descriptionEl = document.getElementById('carousel-description');
    const imageEl = document.getElementById('carousel-image');
    const imagePlaceholder = document.querySelector('.image-placeholder');
    const qrCodeEl = document.getElementById('qr-code');
    const descriptionArea = document.querySelector('.description-scroll-area');

    // -- Seletores para layout D (Calendário)
    const eventsListEl = document.getElementById('events-list');
    const clockEl = document.getElementById('clock');
    const lastUpdatedEl = document.getElementById('last-updated');

    // -- Seletores das barras de progresso
    const carouselProgressBarEl = document.getElementById('progress-bar');
    const calendarProgressBarEl = document.getElementById('calendar-progress-bar');

    // =======================================================
    // 3. INSTÂNCIAS E FUNÇÕES
    // =======================================================
    const qrCodeInstance = new QRCode(qrCodeEl, {
        width: 120,
        height: 120,
        correctLevel: QRCode.CorrectLevel.H
    });

    function parseDateAsLocal(dateString) {
        // Expressão regular para verificar se é uma data sem hora (formato YYYY-MM-DD)
        const dateOnlyRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
        const dateOnlyMatch = dateString.match(dateOnlyRegex);

        if (dateOnlyMatch) {
            // Se for apenas data, construímos o objeto manualmente para evitar erros de fuso.
            const year = parseInt(dateOnlyMatch[1], 10);
            const month = parseInt(dateOnlyMatch[2], 10) - 1; // Meses em JS são de 0 a 11
            const day = parseInt(dateOnlyMatch[3], 10);
            return new Date(year, month, day);
        }

        // Se for uma string de data completa (com hora e fuso), `new Date()` já funciona bem.
        return new Date(dateString);
    }

    /**
     * Cria um objeto Date de forma segura a partir de uma string, evitando problemas de fuso horário.
     * Para strings 'YYYY-MM-DD', garante que a data seja criada à meia-noite no fuso horário local.
     */
    function parseDateAsLocal(dateString) {
        // Expressão regular para verificar se é uma data sem hora (formato YYYY-MM-DD)
        const dateOnlyRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
        const dateOnlyMatch = dateString.match(dateOnlyRegex);

        if (dateOnlyMatch) {
            // Se for apenas data, construímos o objeto manualmente para evitar erros de fuso.
            const year = parseInt(dateOnlyMatch[1], 10);
            const month = parseInt(dateOnlyMatch[2], 10) - 1; // Meses em JS são de 0 a 11
            const day = parseInt(dateOnlyMatch[3], 10);
            return new Date(year, month, day);
        }
        
        // Se for uma string de data completa (com hora e fuso), `new Date()` já funciona bem.
        return new Date(dateString);
    }

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => console.log('Conectado ao servidor WebSocket.');
        socket.onmessage = (event) => {
            if (event.data === 'REFRESH') {
                window.location.reload();
            }
        };
        socket.onclose = () => setTimeout(connectWebSocket, 5000);
        socket.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            socket.close();
        };
    }
    
    function renderCalendar(events) {
        eventsListEl.innerHTML = '';
        if (!events || events.length === 0) {
            eventsListEl.innerHTML = '<div id="empty-message">Nenhum evento futuro encontrado.</div>';
            return;
        }

        const now = new Date();
        let nextEventFound = false;

        events.forEach(event => {
            // Usamos nossa nova função para criar as datas de forma segura
            const start = parseDateAsLocal(event.start);
            const end = parseDateAsLocal(event.end);
            
            const isAllDay = !event.start.includes('T');

            let finalDateTimeStr = '';
            const timeOptions = { hour: '2-digit', minute: '2-digit' };
            const dayOptions = { day: '2-digit', month: '2-digit' };
            
            // A lógica aqui estava boa, o problema era a criação do objeto Date.
            // Para um evento de dia inteiro, a API do Google retorna a data de fim como o dia *seguinte* à meia-noite.
            // Ex: Evento de 1 dia em 31/07 -> start: '2024-07-31', end: '2024-08-01'.
            // Por isso, a diferença de tempo é exatamente 24h.
            const isSameDay = isAllDay && (end.getTime() - start.getTime() <= 24 * 60 * 60 * 1000);

            if (isSameDay) {
                const datePart = start.toLocaleDateString('pt-BR', dayOptions);
                const timePart = isAllDay ? 'Dia Inteiro' : `${start.toLocaleTimeString('pt-BR', timeOptions)} - ${end.toLocaleTimeString('pt-BR', timeOptions)}`;
                finalDateTimeStr = `${datePart}<br><span class="time-range">${timePart}</span>`;
            } else {
                const formatMultiDayPart = (dt) => `${dt.toLocaleDateString('pt-BR', dayOptions)}${isAllDay ? '' : ` ${dt.toLocaleTimeString('pt-BR', timeOptions)}`}`;
                
                // Para eventos de múltiplos dias ou com horário, a data final precisa ser ajustada.
                // Se for dia inteiro, o fim real é o dia anterior ao que a API informa.
                // Subtrair 1 milissegundo é uma forma segura de fazer isso.
                const finalEnd = isAllDay ? new Date(end.getTime() - 1) : end;
                finalDateTimeStr = `<span class="multiday-label">De&nbsp;&nbsp;</span>${formatMultiDayPart(start)}<br><span class="multiday-label">Até</span> ${formatMultiDayPart(finalEnd)}`;
            }

            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';

            if (!isAllDay && now >= start && now <= end) eventItem.classList.add('current-event');
            else if (now < start && !nextEventFound) {
                eventItem.classList.add('next-event');
                nextEventFound = true;
            }
            
            eventItem.innerHTML = `<div class="col-date">${finalDateTimeStr}</div><div class="col-summary">${event.summary}</div>`;
            eventsListEl.appendChild(eventItem);
        });
        
        if(lastUpdatedEl) lastUpdatedEl.textContent = new Date().toLocaleTimeString('pt-BR');
    }

    /**
     * ALTERAÇÃO PRINCIPAL: Gerencia explicitamente a visibilidade dos contêineres.
     */
    function updateDisplay() {
        if (progressIntervalId) clearInterval(progressIntervalId);
        if (scrollAnimationId) cancelAnimationFrame(scrollAnimationId);

        // Se não houver conteúdo, mostra a mensagem de "vazio" e para
        if (!content || content.length === 0) {
            carouselWrapper.style.display = 'none';
            calendarWrapper.style.display = 'none';
            emptyStateContainer.style.display = 'flex';
            return;
        }

        const item = content[currentIndex];

        // 1. Reseta o estado: esconde tudo e remove classes antigas
        emptyStateContainer.style.display = 'none';
        carouselWrapper.style.display = 'none';
        calendarWrapper.style.display = 'none';
        bodyEl.classList.remove('layout-a-active', 'layout-b-active', 'layout-d-active');

        // 2. Configura o layout correto
        if (item.tipo === 'noticia' || item.tipo === 'aviso') {
            carouselWrapper.style.display = 'flex'; // Torna o carrossel visível
            bodyEl.classList.add(item.tipo === 'noticia' ? 'layout-a-active' : 'layout-b-active');

            // Preenche os dados do carrossel
            titleEl.textContent = item.titulo;
            dateEl.textContent = item.data || '';
            descriptionEl.innerHTML = item.descricao || '';
            descriptionArea.scrollTop = 0;
            imageEl.src = ''; // Limpa a imagem anterior

            imagePlaceholder.style.display = 'block';
            imageEl.style.display = 'none';
            if (item.url_imagem) {
                imagePlaceholder.textContent = 'Carregando imagem...';
                imageEl.src = item.url_imagem;
                imageEl.onload = () => { imageEl.style.display = 'block'; imagePlaceholder.style.display = 'none'; };
                imageEl.onerror = () => { imagePlaceholder.textContent = 'Erro ao carregar imagem'; };
            } else {
                imagePlaceholder.textContent = 'Sem imagem disponível';
            }

            if (item.link) {
                qrCodeInstance.makeCode(item.link);
                qrCodeEl.style.display = 'block';
            } else {
                qrCodeEl.style.display = 'none';
            }

            if (item.tipo === 'noticia') {
                setTimeout(startSmoothScroll, 4000);
            }

        } else if (item.tipo === 'calendario') {
            calendarWrapper.style.display = 'flex'; // Torna o calendário visível
            bodyEl.classList.add('layout-d-active');
            renderCalendar(item.eventos);
        }

        // 3. Inicia a barra de progresso para o layout ativo
        startProgressBar();
    }

    /**
     * ALTERAÇÃO: Seleciona a barra de progresso correta.
     */
    function startProgressBar() {
        const item = content[currentIndex];
        // Escolhe qual elemento de barra de progresso usar
        const progressBarFill = (item.tipo === 'calendario') ? calendarProgressBarEl : carouselProgressBarEl;

        // Medida de segurança para evitar erros se o elemento não for encontrado
        if (!progressBarFill) return;

        progressBarFill.style.transition = 'none';
        progressBarFill.style.width = '0%';
        void progressBarFill.offsetWidth; // Força o navegador a aplicar a mudança

        progressBarFill.style.transition = 'width 0.1s linear';

        let startTime = Date.now();
        progressIntervalId = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const progress = (elapsedTime / config.carouselInterval) * 100;
            progressBarFill.style.width = `${Math.min(progress, 100)}%`;
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
        updateDisplay();
        if (content && content.length > 0) {
            carouselIntervalId = setInterval(nextItem, config.carouselInterval);
        }
    }

    function updateClock() {
        if (clockEl) {
            clockEl.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }

    async function fetchAndUpdateContent() {
        try {
            const response = await fetch(`/api/content/${screenId}`);
            if (!response.ok) throw new Error('Falha na resposta da API');
            const newData = await response.json();

            const isContentDifferent = JSON.stringify(content) !== JSON.stringify(newData.content);
            const isConfigDifferent = config.carouselInterval !== newData.config.carouselInterval;

            if (isContentDifferent || isConfigDifferent) {
                content = newData.content;
                config.carouselInterval = newData.config.carouselInterval;
                currentIndex = 0;
                startCarousel();
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

    if (clockEl) {
        updateClock();
        clockIntervalId = setInterval(updateClock, 1000);
    }
});