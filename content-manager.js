const axios = require('axios');
const RssParser = require('rss-parser');
const cheerio = require('cheerio');
const { format } = require('date-fns');
const fs = require('fs').promises;
const path = require('path');

const AVISOS_DB_PATH = path.join(__dirname, 'avisos.json');
const parser = new RssParser();
const LIMITE_DESCRICAO_CARACTERES = 1200;

// A função _carregarAvisosAtivos permanece a mesma.
async function _carregarAvisosAtivos() {
    try {
        const data = await fs.readFile(AVISOS_DB_PATH, 'utf-8');
        const avisos = JSON.parse(data);
        const agora = new Date();

        const avisosAtivos = avisos
            .filter(aviso => {
                if (!aviso.data_inicio || !aviso.data_fim) return false;
                const dataInicio = new Date(aviso.data_inicio.replace(' ', 'T'));
                const dataFim = new Date(aviso.data_fim.replace(' ', 'T'));
                return !isNaN(dataInicio) && !isNaN(dataFim) && dataInicio <= agora && agora <= dataFim;
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

            // =======================================================
            // LÓGICA DE CORREÇÃO DA IMAGEM
            // =======================================================
            let url_imagem = $('img').first().attr('src');
            if (url_imagem) {
                const urlLower = url_imagem.toLowerCase();
                // Verifica se a URL contém a duplicação "fct.ufg.brhttp"
                if (urlLower.includes("fct.ufg.brhttp")) {
                    // Encontra o início da segunda URL 'http' (ignorando a primeira)
                    const startIndex = urlLower.indexOf("http", 1); 
                    if (startIndex !== -1) {
                        // Extrai a parte correta da string original, preservando o case
                        url_imagem = url_imagem.substring(startIndex);
                        console.log(`URL da imagem corrigida para: ${url_imagem}`);
                    }
                }
            }
            // =======================================================

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
                url_imagem: url_imagem, // Usa a URL, corrigida ou não
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

// A função fetchContent permanece a mesma.
async function fetchContent(screenConfig = {}) {
    console.log(`Iniciando atualização de conteúdo para: ${screenConfig.name || 'Tela sem nome'}`);

    // Cria um array de "promessas" para buscar o conteúdo
    const promises = [];

    // ATUALIZADO: Adiciona a busca de avisos à lista de promessas SOMENTE se a config permitir
    // Por padrão, se a propriedade não existir, considera true para retrocompatibilidade.
    if (screenConfig.includeAvisos !== false) {
        promises.push(_carregarAvisosAtivos());
    } else {
        // Se não for para incluir, adiciona uma promessa que resolve para um array vazio
        promises.push(Promise.resolve([]));
        console.log('Avisos globais ignorados para esta tela, conforme configuração.');
    }

    // Adiciona a busca de notícias
    promises.push(_carregarNoticiasFeed(screenConfig));
    
    // Busca todas as fontes de conteúdo em paralelo
    const [avisos, noticias] = await Promise.all(promises);
    
    const conteudo_final = [...avisos, ...noticias];
    
    if (!conteudo_final.length) {
        console.warn("Nenhum conteúdo disponível.");
    } else {
        console.log(`Conteúdo carregado: ${avisos.length} aviso(s), ${noticias.length} notícia(s).`);
    }
    return conteudo_final;
}

module.exports = { fetchContent };