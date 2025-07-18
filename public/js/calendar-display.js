document.addEventListener('DOMContentLoaded', () => {
    const eventsListEl = document.getElementById('events-list');
    const clockEl = document.getElementById('clock');
    const lastUpdatedEl = document.getElementById('last-updated');

    const renderEvents = () => {
        const events = initialData.calendarEvents || [];
        eventsListEl.innerHTML = '';

        if (events.length === 0) {
            eventsListEl.innerHTML = '<div id="empty-message">Nenhum evento nos próximos 60 dias.</div>';
            return;
        }

        const now = new Date();
        let nextEventFound = false;

        events.forEach(event => {
            const start = new Date(event.start);
            const end = new Date(event.end);
            const isAllDay = !event.start.includes('T');

            let finalDateTimeStr = '';
            const timeOptions = { hour: '2-digit', minute: '2-digit' };
            const dayOptions = { day: '2-digit', month: '2-digit' };
            
            // Verificamos se o evento ocorre no mesmo dia
            const isSameDay = start.toDateString() === end.toDateString() || (isAllDay && end.getTime() - start.getTime() <= 24 * 60 * 60 * 1000);

            if (isSameDay) {
                // FORMATO 2: Evento de um dia
                const datePart = start.toLocaleDateString('pt-BR', dayOptions);
                const timePart = isAllDay ? 'Dia Inteiro' : `${start.toLocaleTimeString('pt-BR', timeOptions)} - ${end.toLocaleTimeString('pt-BR', timeOptions)}`;
                
                finalDateTimeStr = `${datePart}<br><span class="time-range">${timePart}</span>`;

            } else {
                // FORMATO 1: Evento de múltiplos dias
                const formatMultiDayPart = (dt) => {
                    const date = dt.toLocaleDateString('pt-BR', dayOptions);
                    const time = isAllDay ? '' : ` ${dt.toLocaleTimeString('pt-BR', timeOptions)}`;
                    return `${date}${time}`;
                };

                const finalEnd = isAllDay ? new Date(end.getTime() - 1) : end;
                const startPart = formatMultiDayPart(start);
                const endPart = formatMultiDayPart(finalEnd);

                finalDateTimeStr = `<span class="multiday-label">De  </span>${startPart}<br><span class="multiday-label">Até</span> ${endPart}`;
            }
            // ==========================================================

            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';

            if (!isAllDay && now >= start && now <= end) {
                eventItem.classList.add('current-event');
            } else if (now < start && !nextEventFound) {
                eventItem.classList.add('next-event');
                nextEventFound = true;
            }
            
            eventItem.innerHTML = `
                <div class="col-date">${finalDateTimeStr}</div>
                <div class="col-summary">${event.summary}</div>
            `;
            eventsListEl.appendChild(eventItem);
        });
        
        lastUpdatedEl.textContent = new Date().toLocaleTimeString('pt-BR');
    };

    const updateClock = () => {
        clockEl.textContent = new Date().toLocaleTimeString('pt-BR');
    };
    
    renderEvents();
    updateClock();
    setInterval(renderEvents, 60 * 1000); 
    setInterval(updateClock, 1000);
    
    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => console.log('Conectado ao servidor WebSocket.');
        socket.onmessage = (event) => {
            if (event.data === 'REFRESH') window.location.reload();
        };
        socket.onclose = () => setTimeout(connectWebSocket, 5000);
    }
    connectWebSocket();
});