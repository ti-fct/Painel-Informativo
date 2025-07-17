// =======================================================
// 1. IMPORTS
// =======================================================
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const { WebSocketServer } = require('ws');
const multer = require('multer');

// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config();

// =======================================================
// Melhoria nos Logs com Timestamp
// =======================================================

// Salva as funções de log originais
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Função para obter o timestamp formatado
const getTimestamp = () => new Date().toLocaleString('pt-BR');

// Sobrescreve console.log com nível INFO
console.log = function(...args) {
    originalLog(`[${getTimestamp()}] [INFO]`, ...args);
};

// Sobrescreve console.warn com nível WARN
console.warn = function(...args) {
    originalWarn(`[${getTimestamp()}] [WARN]`, ...args);
};

// Sobrescreve console.error com nível ERROR
console.error = function(...args) {
    originalError(`[${getTimestamp()}] [ERROR]`, ...args);
};


// =======================================================
// 2. CONSTANTES E INICIALIZAÇÃO
// =======================================================
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.json');
const AVISOS_DB_PATH = path.join(__dirname, 'avisos.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const contentManager = require('./content-manager');

// =======================================================
// 3. CONFIGURAÇÃO DO MULTER
// =======================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(UPLOADS_DIR, { recursive: true }).then(() => cb(null, UPLOADS_DIR)).catch(err => cb(err));
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`)
});
const upload = multer({ storage });

// =======================================================
// 4. MIDDLEWARE DO EXPRESS
// =======================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.urlencoded({ extended: true }));

// Validação do SESSION_SECRET ao iniciar
if (!process.env.SESSION_SECRET) {
    console.warn("AVISO: A variável de ambiente SESSION_SECRET não está definida. Usando um valor padrão inseguro.");
    console.warn("Para produção, copie .env.example para .env e defina um SESSION_SECRET único e seguro.");
}

app.use(session({
    // ALTERAÇÃO: Usa a variável de ambiente ou um fallback com aviso.
    secret: process.env.SESSION_SECRET || 'insecure-default-secret-for-dev',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// =======================================================
// 5. FUNÇÕES AUXILIARES (DB, IDs, etc.)
// =======================================================
// Para as telas (db.json)
async function readDB() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await writeDB({ screens: [] });
            return { screens: [] };
        }
        throw error;
    }
}
async function writeDB(data) {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
// Função para numerar telas
async function generateNextScreenId() {
    const db = await readDB();

    if (!db.screens || db.screens.length === 0) {
        // Se não houver telas, começa com "001"
        return "001";
    }

    // Encontra o maior ID numérico atual
    const maxId = db.screens.reduce((max, screen) => {
        const currentId = parseInt(screen.id, 10);
        return currentId > max ? currentId : max;
    }, 0);

    // Incrementa o maior ID e formata para ter 3 dígitos
    const nextId = maxId + 1;
    return nextId.toString().padStart(3, '0');
}

// Para os avisos (avisos.json)
async function readAvisos() {
    try {
        const data = await fs.readFile(AVISOS_DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        if (e.code === 'ENOENT') {
            await writeAvisos([]);
            return [];
        }
        console.error("Erro ao ler avisos.json", e);
        return [];
    }
}
async function writeAvisos(data) {
    await fs.writeFile(AVISOS_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
const getFullImageUrl = (req, filename) => `${req.protocol}://${req.get('host')}/uploads/${filename}`;

// =======================================================
// 6. LÓGICA DO WEBSOCKET
// =======================================================
// Função para enviar dados apenas para os dashboards
function broadcastToDashboards(data) {
    wss.clients.forEach(client => {
        // Identifica um cliente do dashboard por uma propriedade que adicionaremos
        if (client.isDashboard) {
            client.send(JSON.stringify(data));
        }
    });
}

// Heartbeat para limpar conexões inativas
function heartbeat() {
    this.isAlive = true;
}

const interval = setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            console.log(`🔌 Terminando conexão inativa (sem resposta ao ping).`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping(() => { });
    });
}, 30000);

wss.on('connection', (ws, req) => {
    // Verifica a URL da conexão para saber se é um dashboard

    // Inicia o controle de "vida" do cliente
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    if (req.url === '/dashboard-ws') {
        ws.isDashboard = true;
        console.log('✅ Um Dashboard se conectou via WebSocket.');
        // Envia a contagem inicial assim que o dashboard se conecta
        broadcastToDashboards({
            type: 'active_screens_count',
            count: Array.from(wss.clients).filter(c => !c.isDashboard).length
        });
    } else {
        ws.isDashboard = false;
        console.log('✅ Uma Tela de Exibição se conectou via WebSocket.');
        // Informa aos dashboards que uma nova tela se conectou
        broadcastToDashboards({
            type: 'active_screens_count',
            count: Array.from(wss.clients).filter(c => !c.isDashboard).length
        });
    }

    ws.on('close', () => {
        console.log(`❌ Um cliente (${ws.isDashboard ? 'Dashboard' : 'Tela'}) desconectou.`);
        // Sempre recalcula e transmite a contagem quando qualquer cliente se desconecta.
        // Isso garante que os dashboards estejam sempre sincronizados, mesmo se um deles se reconectar.
        // O filtro !c.isDashboard garante que a contagem em si permaneça correta.
        broadcastToDashboards({
            type: 'active_screens_count',
            count: Array.from(wss.clients).filter(c => !c.isDashboard).length
        });
    });
    ws.on('error', (error) => console.error('WebSocket Error:', error));
});

// Limpa o intervalo se o servidor for fechado
wss.on('close', () => {
    clearInterval(interval);
});

function broadcastRefresh() {
    console.log(`📡 Transmitindo comando de refresh para as telas...`);
    wss.clients.forEach(client => {
        // Envia o refresh apenas para as telas de exibição, não para o dashboard
        if (!client.isDashboard && client.readyState === client.OPEN) {
            client.send('REFRESH');
        }
    });
}

// =======================================================
// 7. ROTAS
// =======================================================
const requireAuth = (req, res, next) => {
    if (req.session.isLoggedIn) next();
    else res.redirect('/admin/login');
};

/// --- ROTAS PÚBLICAS ---
app.get('/display/:id', async (req, res) => {
    try {
        const db = await readDB();
        const screen = db.screens.find(s => s.id === req.params.id);
        if (!screen) return res.status(404).send('Tela não encontrada.');

        // 1. O contentManager retorna um objeto completo com todas as informações.
        const initialData = await contentManager.fetchContent(screen);

        // 2. Passamos esse objeto inteiro para a view.
        //    O EJS terá acesso a `screenId`, `screenName`, `content` e `config`.
        //    A renderização usará 'layout-a', 'layout-b' ou o novo 'layout-c'
        res.render(screen.layout, initialData);

    } catch (error) {
        console.error("Erro ao carregar tela de exibição:", error);
        res.status(500).send("Erro ao carregar conteúdo da tela.");
    }
});

app.get('/api/content/:id', async (req, res) => {
    try {
        const db = await readDB();
        const screen = db.screens.find(s => s.id === req.params.id);
        if (!screen) return res.status(404).json({ error: 'Configuração da tela não encontrada.' });

        // A API também deve retornar o mesmo objeto completo.
        const data = await contentManager.fetchContent(screen);
        res.json(data);

    } catch (error) {
        console.error("Erro na API de conteúdo:", error);
        res.status(500).json({ error: "Não foi possível buscar o conteúdo." });
    }
});

// --- ROTAS DE ADMINISTRAÇÃO ---
app.get('/', (req, res) => res.redirect('/admin/login'));
app.get('/admin/login', (req, res) => res.render('login', { error: null }));

app.post('/admin/login', (req, res) => {
    // Lê as credenciais das variáveis de ambiente
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin'; // 'admin' como fallback de segurança

    // ALTERADO: Comparação com as variáveis de ambienteNPM
    if (req.body.username === adminUser && req.body.password === adminPass) {
        req.session.isLoggedIn = true;
        res.redirect('/admin/dashboard');
    } else {
        res.render('login', { error: 'Usuário ou senha inválidos' });
    }
});
app.get('/admin/dashboard', requireAuth, async (req, res) => {
    const db = await readDB();
    res.render('dashboard', { screens: db.screens });
});
app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/admin/login'));
});

// NOVO: Rota para informações do servidor
app.get('/api/server-info', requireAuth, (req, res) => {
    res.json({
        serverTime: new Date().toISOString(), // Envia a hora em formato padrão ISO
        updateInterval: 1800 // Intervalo de 30 minutos em segundos
    });
});

// --- CRUD DE TELAS ---
app.get('/admin/screen/new', requireAuth, (req, res) => {
    res.render('screen-form', { pageTitle: 'Adicionar Nova Tela', formAction: '/admin/screen/new', screen: null });
});

// ALTERAÇÃO: Rota de criação de tela
app.post('/admin/screen/new', requireAuth, async (req, res) => {
    try {
        // 1. Recebe o valor em segundos
        const { name, layout, rssFeedUrl, newsQuantity, carouselIntervalSeconds, includeAvisos, includeRss } = req.body;

        // 2. Converte para milissegundos antes de salvar
        const carouselInterval = parseInt(carouselIntervalSeconds, 10) * 1000;

        const newScreen = {
            id: await generateNextScreenId(),
            name,
            layout,
            config: {
                rssFeedUrl: includeRss === 'true' ? rssFeedUrl : '',
                newsQuantity: includeRss === 'true' ? parseInt(newsQuantity, 10) : 0,
                carouselInterval: carouselInterval, // 3. Salva o valor em milissegundos
                includeAvisos: includeAvisos === 'true',
                includeRss: includeRss === 'true'
            }
        };
        const db = await readDB();
        db.screens.push(newScreen);
        await writeDB(db);
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Erro ao salvar nova tela:', error);
        res.status(500).send('Erro ao salvar a tela.');
    }
});

app.get('/admin/screen/edit/:id', requireAuth, async (req, res) => {
    const db = await readDB();
    const screen = db.screens.find(s => s.id === req.params.id);
    if (!screen) return res.status(404).send('Tela não encontrada.');
    res.render('screen-form', { pageTitle: 'Editar Tela', formAction: `/admin/screen/edit/${screen.id}`, screen: screen });
});

// ALTERAÇÃO: Rota de edição de tela
app.post('/admin/screen/edit/:id', requireAuth, async (req, res) => {
    try {
        // 1. Recebe o valor em segundos
        const { name, layout, rssFeedUrl, newsQuantity, carouselIntervalSeconds, includeAvisos, includeRss } = req.body;
        
        // 2. Converte para milissegundos antes de salvar
        const carouselInterval = parseInt(carouselIntervalSeconds, 10) * 1000;

        const db = await readDB();
        const screenIndex = db.screens.findIndex(s => s.id === req.params.id);
        if (screenIndex === -1) return res.status(404).send('Tela não encontrada.');

        const existingConfig = db.screens[screenIndex].config;

        db.screens[screenIndex] = {
            id: req.params.id,
            name,
            layout,
            config: {
                rssFeedUrl: (includeRss === 'true') ? rssFeedUrl : existingConfig.rssFeedUrl,
                newsQuantity: (includeRss === 'true') ? parseInt(newsQuantity, 10) : existingConfig.newsQuantity,
                carouselInterval: carouselInterval, // 3. Salva o valor em milissegundos
                includeAvisos: includeAvisos === 'true',
                includeRss: includeRss === 'true'
            }
        };

        await writeDB(db);
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Erro ao atualizar tela:', error);
        res.status(500).send('Erro ao atualizar a tela.');
    }
});


app.post('/admin/screen/delete/:id', requireAuth, async (req, res) => {
    const db = await readDB();
    db.screens = db.screens.filter(s => s.id !== req.params.id);
    await writeDB(db);
    res.redirect('/admin/dashboard');
});

// --- GERENCIADOR DE AVISOS ---
app.post('/admin/refresh-all', requireAuth, (req, res) => {
    broadcastRefresh();
    res.redirect('/admin/dashboard');
});

// MODIFICAÇÃO: Passar a lista de telas para a view
app.get('/admin/avisos', requireAuth, async (req, res) => {
    try {
        const db = await readDB();
        // Passa a lista de telas para que o formulário possa renderizar as opções
        res.render('avisos', { screens: db.screens || [] });
    } catch (error) {
        console.error("Erro ao carregar página de avisos:", error);
        res.status(500).render('avisos', { screens: [] }); // Renderiza a página mesmo com erro
    }
});

// =======================================================
// 8. API DE AVISOS 
// =======================================================
app.get('/api/avisos', async (req, res) => {
    const avisos = await readAvisos();
    res.json(avisos);
});

// MODIFICAÇÃO: Capturar e salvar 'targetScreens'
app.post('/api/avisos', requireAuth, upload.single('url_imagem'), async (req, res) => {
    const { titulo, descricao, data_inicio, data_fim, link, targetScreens } = req.body;
    if (!titulo || !descricao) {
        return res.status(400).json({ success: false, message: 'Título e descrição são obrigatórios.' });
    }

    // Garante que 'targetScreens' seja sempre um array
    const screensArray = Array.isArray(targetScreens) ? targetScreens : (targetScreens ? [targetScreens] : []);

    const avisos = await readAvisos();
    const newAviso = {
        titulo, descricao, data_inicio, data_fim, link: link || '',
        url_imagem: req.file ? getFullImageUrl(req, req.file.filename) : '',
        targetScreens: screensArray // Salva o array de telas
    };
    avisos.push(newAviso);
    await writeAvisos(avisos);
    broadcastRefresh();
    res.status(201).json({ success: true, message: 'Aviso criado com sucesso!' });
});

// MODIFICAÇÃO: Capturar e atualizar 'targetScreens'
app.put('/api/avisos/:index', requireAuth, upload.single('url_imagem'), async (req, res) => {
    const avisos = await readAvisos();
    const index = parseInt(req.params.index);
    if (index < 0 || index >= avisos.length) return res.status(404).json({ success: false, message: 'Aviso não encontrado.' });

    // Garante que 'targetScreens' seja sempre um array
    const { targetScreens, ...otherBodyData } = req.body;
    const screensArray = Array.isArray(targetScreens) ? targetScreens : (targetScreens ? [targetScreens] : []);
    
    const updatedAviso = { ...avisos[index], ...otherBodyData, targetScreens: screensArray };
    delete updatedAviso.aviso_index;

    if (req.file) {
        updatedAviso.url_imagem = getFullImageUrl(req, req.file.filename);
    }
    avisos[index] = updatedAviso;
    await writeAvisos(avisos);
    broadcastRefresh();
    res.json({ success: true, message: 'Aviso atualizado com sucesso!' });
});
app.delete('/api/avisos/:index', requireAuth, async (req, res) => {
    try {
        const avisos = await readAvisos();
        const index = parseInt(req.params.index, 10);

        // Validação: garante que o índice é um número válido e está dentro dos limites do array
        if (isNaN(index) || index < 0 || index >= avisos.length) {
            return res.status(404).json({ success: false, message: 'Aviso não encontrado ou índice inválido.' });
        }

        // Remove o aviso do array usando splice.
        // O splice retorna um array com os itens removidos, então pegamos o primeiro (e único) item.
        const [deletedAviso] = avisos.splice(index, 1);

        // Lógica para remover a imagem associada, se houver
        if (deletedAviso && deletedAviso.url_imagem && deletedAviso.url_imagem.includes('/uploads/')) {
            try {
                // Extrai o nome do arquivo da URL completa
                const imageFilename = path.basename(new URL(deletedAviso.url_imagem).pathname);
                const imagePath = path.join(UPLOADS_DIR, imageFilename);

                // Verifica se o arquivo existe antes de tentar apagar
                if (fs.existsSync(imagePath)) {
                    await fs.unlink(imagePath); // Usa a versão assíncrona
                    console.log(`Imagem removida: ${imagePath}`);
                }
            } catch (e) {
                // Loga o erro, mas não impede a resposta de sucesso, pois o aviso foi removido do JSON.
                console.error("Não foi possível remover o arquivo de imagem associado:", e.message);
            }
        }

        // Salva o array modificado de volta no arquivo JSON
        await writeAvisos(avisos);

        // Dispara o refresh para todas as telas ativas
        broadcastRefresh();

        // Responde com sucesso
        res.json({ success: true, message: 'Aviso removido com sucesso!' });

    } catch (error) {
        console.error('Erro ao excluir aviso:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor ao tentar excluir o aviso.' });
    }
});

// =======================================================
// 9. INICIALIZAÇÃO DO SERVIDOR
// =======================================================
server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP e WebSocket rodando em http://localhost:${PORT}`);
    console.log(`🔑 Acesse a administração em http://localhost:${PORT}/admin/login`);
});