// public/js/calendar-display.js

document.addEventListener('DOMContentLoaded', () => {
    const eventsListEl = document.getElementById('events-list');
    const clockEl = document.getElementById('clock');
    const lastUpdatedEl = document.getElementById('last-updated');

    /**
     * Cria um objeto Date de forma segura a partir de uma string, evitando problemas de fuso horário.
     * Para strings 'YYYY-MM-DD', garante que a data seja criada à meia-noite no fuso horário local.
     */
    function parseDateAsLocal(dateString) {
        const dateOnlyRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
        const dateOnlyMatch = dateString.match(dateOnlyRegex);

        if (dateOnlyMatch) {
            const year = parseInt(dateOnlyMatch[1], 10);
            const month = parseInt(dateOnlyMatch[2], 10) - 1;
            const day = parseInt(dateOnlyMatch[3], 10);
            return new Date(year, month, day);
        }
        return new Date(dateString);
    }

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
            // *** MUDANÇA APLICADA AQUI ***
            const start = parseDateAsLocal(event.start);
            const end = parseDateAsLocal(event.end);
            
            const isAllDay = !event.start.includes('T');

            let finalDateTimeStr = '';
            const timeOptions = { hour: '2-digit', minute: '2-digit' };
            const dayOptions = { day: '2-digit', month: '2-digit' };
            
            const isSameDay = isAllDay && (end.getTime() - start.getTime() <= 24 * 60 * 60 * 1000);

            if (isSameDay) {
                const datePart = start.toLocaleDateString('pt-BR', dayOptions);
                const timePart = isAllDay ? 'Dia Inteiro' : `${start.toLocaleTimeString('pt-BR', timeOptions)} - ${end.toLocaleTimeString('pt-BR', timeOptions)}`;
                finalDateTimeStr = `${datePart}<br><span class="time-range">${timePart}</span>`;
            } else {
                const formatMultiDayPart = (dt) => {
                    const date = dt.toLocaleDateString('pt-BR', dayOptions);
                    const time = isAllDay ? '' : ` ${dt.toLocaleTimeString('pt-BR', timeOptions)}`;
                    return `${date}${time}`;
                };

                const finalEnd = isAllDay ? new Date(end.getTime() - 1) : end;
                const startPart = formatMultiDayPart(start);
                const endPart = formatMultiDayPart(finalEnd);

                finalDateTimeStr = `<span class="multiday-label">De&nbsp;&nbsp;</span>${startPart}<br><span class="multiday-label">Até</span> ${endPart}`;
            }

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