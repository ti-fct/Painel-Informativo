const axios = require('axios');
const RssParser = require('rss-parser');
const cheerio = require('cheerio');
const { format, addDays } = require('date-fns');
const fs = require('fs').promises;
const path = require('path');

const AVISOS_DB_PATH = path.join(__dirname, 'avisos.json');
const parser = new RssParser();
const LIMITE_DESCRICAO_CARACTERES = 1200;

async function _carregarEventosCalendario(screenConfig) {
    if (!screenConfig.includeCalendar || !screenConfig.calendarId) {
        return [];
    }
    if (!process.env.GOOGLE_CALENDAR_API_KEY) {
        console.error("A variável de ambiente GOOGLE_CALENDAR_API_KEY não está definida. Não é possível buscar eventos.");
        return [];
    }

    const calendarId = encodeURIComponent(screenConfig.calendarId);
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
    const timeMin = new Date().toISOString();
    const timeMax = addDays(new Date(), 60).toISOString(); // Eventos dos próximos 60 dias

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

    try {
        const response = await axios.get(url);
        const events = response.data.items || [];
        
        console.log(`Buscados ${events.length} eventos do calendário: ${screenConfig.calendarId}`);

        return events.map(event => ({
            summary: event.summary,
            description: event.description || '',
            start: event.start.dateTime || event.start.date, // Trata eventos do dia todo
            end: event.end.dateTime || event.end.date,
            tipo: 'evento' // Tipo para identificação no futuro
        }));

    } catch (error) {
        console.error(`Erro ao buscar eventos do Google Calendar (ID: ${screenConfig.calendarId}):`, error.response ? error.response.data : error.message);
        return []; // Retorna array vazio em caso de erro
    }
}

// A função agora recebe o ID da tela que está pedindo os avisos
async function _carregarAvisosAtivos(screenId) {
    try {
        const data = await fs.readFile(AVISOS_DB_PATH, 'utf-8');
        const avisos = JSON.parse(data);
        const agora = new Date();

        const avisosAtivos = avisos
            .filter(aviso => {
                // 1. Filtro por data (lógica existente)
                if (!aviso.data_inicio || !aviso.data_fim) return false;
                const dataInicio = new Date(aviso.data_inicio.replace(' ', 'T'));
                const dataFim = new Date(aviso.data_fim.replace(' ', 'T'));
                const isDateValid = !isNaN(dataInicio) && !isNaN(dataFim) && dataInicio <= agora && agora <= dataFim;
                if (!isDateValid) return false;
                
                // 2. Novo filtro por tela de destino
                const isGlobal = !aviso.targetScreens || aviso.targetScreens.length === 0;
                const isTargeted = Array.isArray(aviso.targetScreens) && aviso.targetScreens.includes(screenId);

                return isGlobal || isTargeted;
            })
            .map(aviso => {
                const dataFimFormatada = format(new Date(aviso.data_fim.replace(' ', 'T')), "dd/MM/yyyy 'às' HH:mm");
                return {
                    titulo: aviso.titulo,
                    descricao: aviso.descricao,
                    link: aviso.link || '',
                    url_imagem: aviso.url_imagem,
                    data: `Aviso válido até ${dataFimFormatada}`,
                    tipo: 'aviso'
                };
            });
        return avisosAtivos;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn("Arquivo 'avisos.json' não encontrado. Nenhum aviso será carregado.");
            return [];
        }
        console.error("Erro ao carregar avisos do arquivo JSON:", error);
        return [];
    }
}

/**
 * Busca e processa as notícias de um feed RSS, com base na configuração da tela.
 * Inclui lógica aprimorada para corrigir URLs de imagem malformadas.
 * @param {object} screenConfig - A configuração da tela (rssFeedUrl, newsQuantity).
 * @returns {Promise<Array>} Uma promessa que resolve para um array de objetos de notícia.
 */
async function _carregarNoticiasFeed(screenConfig) {
    try {
        const feedUrl = screenConfig.rssFeedUrl;
        if (!feedUrl) return [];

        const newsQuantity = screenConfig.newsQuantity || 5;
        const feed = await parser.parseURL(feedUrl);
        const entradasProcessadas = [];

        for (const item of feed.items.slice(0, newsQuantity)) {
            const content = item['content:encoded'] || item.content || '';
            const $ = cheerio.load(content);

            let url_imagem = $('img').first().attr('src');
            if (url_imagem) {
                const urlLower = url_imagem.toLowerCase();
                if (urlLower.includes("fct.ufg.brhttp") || urlLower.includes("ufg.brhttp")) {
                    const startIndex = urlLower.indexOf("http", 1);
                    if (startIndex !== -1) {
                        url_imagem = url_imagem.substring(startIndex);
                        console.log(`URL da imagem corrigida para: ${url_imagem}`);
                    }
                }
            }

            $('script, style').remove();
            let descricao = $('body').text().replace(/\s\s+/g, ' ').trim();
            const hint_message = "<br><br><i>(Leia a notícia completa no QR Code)</i>";
            if (descricao.length > LIMITE_DESCRICAO_CARACTERES) {
                let posicao_corte = descricao.lastIndexOf(' ', LIMITE_DESCRICAO_CARACTERES);
                if (posicao_corte === -1) posicao_corte = LIMITE_DESCRICAO_CARACTERES;
                descricao = descricao.substring(0, posicao_corte) + "..." + hint_message;
            }

            let data_formatada = "Data não disponível";
            if (item.isoDate) {
                try {
                    data_formatada = format(new Date(item.isoDate), 'dd/MM/yyyy - HH:mm');
                } catch (e) { console.warn(`Data inválida para o item: ${item.title}`); }
            }

            entradasProcessadas.push({
                titulo: item.title,
                descricao: descricao,
                link: item.link,
                url_imagem: url_imagem,
                data: data_formatada,
                tipo: 'noticia'
            });
        }
        return entradasProcessadas;
    } catch (error) {
        console.error(`Erro ao obter notícias do feed (${screenConfig.rssFeedUrl}):`, error.message);
        return [];
    }
}

async function fetchContent(screen) {
    const screenConfig = screen.config || {};
    console.log(`Iniciando atualização de conteúdo para: ${screen.name || 'Tela sem nome'} (ID: ${screen.id})`);

    const promises = [];

    if (screenConfig.includeAvisos !== false) {
        promises.push(_carregarAvisosAtivos(screen.id));
    } else {
        promises.push(Promise.resolve([]));
    }

    if (screenConfig.includeRss !== false) {
        promises.push(_carregarNoticiasFeed(screenConfig));
    } else {
        promises.push(Promise.resolve([]));
    }
    
    if (screenConfig.includeCalendar !== false) {
        promises.push(_carregarEventosCalendario(screenConfig));
    } else {
        promises.push(Promise.resolve([]));
    }

    const [avisos, noticias, eventos] = await Promise.all(promises);
    const content = [...avisos, ...noticias]; 

    console.log(`Conteúdo carregado: ${avisos.length} aviso(s), ${noticias.length} notícia(s), ${eventos.length} evento(s).`);

    return {
        screenId: screen.id,
        screenName: screen.name,
        content: content,
        calendarEvents: eventos, // Passa os eventos separadamente para o layout
        config: {
            carouselInterval: screenConfig.carouselInterval,
            contentUpdateInterval: 1800 * 1000,
        }
    };
}

module.exports = { fetchContent };