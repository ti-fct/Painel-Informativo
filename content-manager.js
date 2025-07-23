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
    const timeMax = addDays(new Date(), 60).toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

    try {
        const response = await axios.get(url);
        const events = response.data.items || [];
        
        console.log(`Buscados ${events.length} eventos do calendário: ${screenConfig.calendarId}`);

        return events.map(event => ({
            summary: event.summary,
            description: event.description || '',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            tipo: 'evento'
        }));

    } catch (error) {
        console.error(`Erro ao buscar eventos do Google Calendar (ID: ${screenConfig.calendarId}):`, error.response ? error.response.data : error.message);
        return [];
    }
}

async function _carregarAvisosAtivos(screenId) {
    try {
        const data = await fs.readFile(AVISOS_DB_PATH, 'utf-8');
        const avisos = JSON.parse(data);
        const agora = new Date();

        return avisos
            .filter(aviso => {
                if (!aviso.data_inicio || !aviso.data_fim) return false;
                const dataInicio = new Date(aviso.data_inicio.replace(' ', 'T'));
                const dataFim = new Date(aviso.data_fim.replace(' ', 'T'));
                if (isNaN(dataInicio) || isNaN(dataFim) || !(dataInicio <= agora && agora <= dataFim)) return false;
                
                const isGlobal = !aviso.targetScreens || aviso.targetScreens.length === 0;
                const isTargeted = Array.isArray(aviso.targetScreens) && aviso.targetScreens.includes(screenId);
                return isGlobal || isTargeted;
            })
            .map(aviso => ({
                titulo: aviso.titulo,
                descricao: aviso.descricao,
                link: aviso.link || '',
                url_imagem: aviso.url_imagem,
                data: `Aviso válido até ${format(new Date(aviso.data_fim.replace(' ', 'T')), "dd/MM/yyyy 'às' HH:mm")}`,
                tipo: 'aviso'
            }));
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn("Arquivo 'avisos.json' não encontrado. Nenhum aviso será carregado.");
        } else {
            console.error("Erro ao carregar avisos do arquivo JSON:", error);
        }
        return [];
    }
}

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
                    }
                }
            }

            $('script, style').remove();
            let descricao = $('body').text().replace(/\s\s+/g, ' ').trim();
            const hint_message = "<br><br><i>(Leia a notícia completa no QR Code)</i>";
            if (descricao.length > LIMITE_DESCRICAO_CARACTERES) {
                let posicao_corte = descricao.lastIndexOf(' ', LIMITE_DESCRICAO_CARACTERES);
                descricao = descricao.substring(0, posicao_corte > 0 ? posicao_corte : LIMITE_DESCRICAO_CARACTERES) + "..." + hint_message;
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

    const promises = [
        screenConfig.includeAvisos ? _carregarAvisosAtivos(screen.id) : Promise.resolve([]),
        screenConfig.includeRss ? _carregarNoticiasFeed(screenConfig) : Promise.resolve([]),
        screenConfig.includeCalendar ? _carregarEventosCalendario(screenConfig) : Promise.resolve([])
    ];

    const [avisos, noticias, eventos] = await Promise.all(promises);

    let content = [...avisos, ...noticias]; 

    if (eventos.length > 0) {
        content.push({
            tipo: 'calendario',
            titulo: 'Próximos Eventos',
            eventos: eventos
        });
    }

    console.log(`Conteúdo final montado: ${avisos.length} aviso(s), ${noticias.length} notícia(s), ${eventos.length > 0 ? 1 : 0} slide(s) de calendário.`);
    
    // A função agora retorna sempre a mesma estrutura de dados, que é o que o layout dinâmico espera.
    return {
        screenId: screen.id,
        screenName: screen.name,
        content: content,
        calendarEvents: eventos,
        config: {
            carouselInterval: screenConfig.carouselInterval,
            contentUpdateInterval: 1800 * 1000,
        }
    };
}

module.exports = { fetchContent };