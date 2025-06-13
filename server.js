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

// =======================================================
// 2. CONSTANTES E INICIALIZAÇÃO
// =======================================================
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.json'); // Para as telas
const AVISOS_DB_PATH = path.join(__dirname, 'avisos.json'); // Para os avisos
const UPLOADS_DIR = path.join(__dirname, 'uploads'); // Pasta de uploads

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const contentManager = require('./content-manager');

// =======================================================
// 3. CONFIGURAÇÃO DO MULTER (para Avisos)
// =======================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Garante que a pasta de uploads exista
        fs.mkdir(UPLOADS_DIR, { recursive: true }).then(() => {
            cb(null, UPLOADS_DIR);
        }).catch(err => cb(err, UPLOADS_DIR));
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage: storage });

// =======================================================
// 4. CONFIGURAÇÃO DO EXPRESS (MIDDLEWARE)
// =======================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR)); // Servir imagens dos avisos
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'seu-segredo-super-secreto-aqui-troque-depois',
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
async function generateUniqueScreenId() {
    const db = await readDB();
    const existingIds = new Set(db.screens.map(s => s.id));
    let newId;
    do {
        newId = Math.floor(1000 + Math.random() * 9000).toString();
    } while (existingIds.has(newId));
    return newId;
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
wss.on('connection', ws => {
    console.log('✅ Uma nova tela se conectou via WebSocket.');
    ws.on('close', () => console.log('❌ Uma tela desconectou.'));
    ws.on('error', (error) => console.error('WebSocket Error:', error));
});

function broadcastRefresh() {
    console.log(`📡 Transmitindo comando de refresh para ${wss.clients.size} tela(s)...`);
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
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

// --- Rotas Públicas ---
app.get('/display/:id', async (req, res) => {
    try {
        const db = await readDB();
        const screen = db.screens.find(s => s.id === req.params.id);
        if (!screen) return res.status(404).send('Tela não encontrada.');

        const initialContent = await contentManager.fetchContent(screen.config);
        
        if (screen.layout === 'layout-a') {
            res.render('layout-a', {
                screenId: screen.id,
                screenName: screen.name,
                initialContent: JSON.stringify(initialContent),
                config: {
                    carouselInterval: screen.config.carouselInterval,
                    contentUpdateInterval: 1800 * 1000
                }
            });
        } else {
            res.status(404).send('Layout desconhecido.');
        }
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
        
        const content = await contentManager.fetchContent(screen.config);
        res.json(content);
    } catch (error) {
        console.error("Erro na API de conteúdo:", error);
        res.status(500).json({ error: "Não foi possível buscar o conteúdo." });
    }
});


// --- Rotas de Administração ---
app.get('/', (req, res) => res.redirect('/admin/login'));

app.get('/admin/login', (req, res) => res.render('login', { error: null }));

app.post('/admin/login', (req, res) => {
    if (req.body.username === 'admin' && req.body.password === 'admin123') {
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

// --- CRUD de Telas ---
app.get('/admin/screen/new', requireAuth, (req, res) => res.render('screen-form', { pageTitle: 'Adicionar Nova Tela', formAction: '/admin/screen/new', screen: null }));
app.post('/admin/screen/new', requireAuth, async (req, res) => {
    const { name, layout, rssFeedUrl, carouselInterval, newsQuantity } = req.body;
    const newScreen = {
        id: await generateUniqueScreenId(),
        name, layout, config: { rssFeedUrl, carouselInterval: parseInt(carouselInterval), newsQuantity: parseInt(newsQuantity) }
    };
    const db = await readDB();
    db.screens.push(newScreen);
    await writeDB(db);
    res.redirect('/admin/dashboard');

        try {
        // ATUALIZADO: captura 'includeAvisos' do corpo da requisição
        const { name, layout, rssFeedUrl, carouselInterval, newsQuantity, includeAvisos } = req.body;

        const newScreen = {
            id: await generateUniqueScreenId(),
            name,
            layout,
            config: {
                rssFeedUrl,
                carouselInterval: parseInt(carouselInterval, 10),
                newsQuantity: parseInt(newsQuantity, 10),
                // Converte o valor do checkbox para um booleano real
                includeAvisos: includeAvisos === 'true'
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

// Rota para processar a atualização da tela
app.post('/admin/screen/edit/:id', requireAuth, async (req, res) => {
    try {
        // ATUALIZADO: captura 'includeAvisos' do corpo da requisição
        const { name, layout, rssFeedUrl, carouselInterval, newsQuantity, includeAvisos } = req.body;
        const db = await readDB();
        
        const screenIndex = db.screens.findIndex(s => s.id === req.params.id);
        if (screenIndex === -1) return res.status(404).send('Tela não encontrada.');

        db.screens[screenIndex] = {
            id: req.params.id,
            name,
            layout,
            config: {
                rssFeedUrl,
                carouselInterval: parseInt(carouselInterval, 10),
                newsQuantity: parseInt(newsQuantity, 10),
                // Converte o valor do checkbox para um booleano real
                includeAvisos: includeAvisos === 'true'
            }
        };

        await writeDB(db);
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Erro ao atualizar tela:', error);
        res.status(500).send('Erro ao atualizar a tela.');
    }

});
app.get('/admin/screen/edit/:id', requireAuth, async (req, res) => {
    const db = await readDB();
    const screen = db.screens.find(s => s.id === req.params.id);
    if (!screen) return res.status(404).send('Tela não encontrada.');
    res.render('screen-form', { pageTitle: 'Editar Tela', formAction: `/admin/screen/edit/${screen.id}`, screen: screen });
});
app.post('/admin/screen/edit/:id', requireAuth, async (req, res) => {
    const { name, layout, rssFeedUrl, carouselInterval, newsQuantity } = req.body;
    const db = await readDB();
    const screenIndex = db.screens.findIndex(s => s.id === req.params.id);
    if (screenIndex === -1) return res.status(404).send('Tela não encontrada.');
    db.screens[screenIndex] = {
        id: req.params.id, name, layout, config: { rssFeedUrl, carouselInterval: parseInt(carouselInterval), newsQuantity: parseInt(newsQuantity) }
    };
    await writeDB(db);
    res.redirect('/admin/dashboard');
});
app.post('/admin/screen/delete/:id', requireAuth, async (req, res) => {
    const db = await readDB();
    db.screens = db.screens.filter(s => s.id !== req.params.id);
    await writeDB(db);
    res.redirect('/admin/dashboard');
});

// --- Rota de Refresh e Gerenciador de Avisos ---
app.post('/admin/refresh-all', requireAuth, (req, res) => {
    broadcastRefresh();
    res.redirect('/admin/dashboard');
});
app.get('/admin/avisos', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'avisos.html'));
});

// =======================================================
// 8. API DE AVISOS
// =======================================================
app.get('/api/avisos', async (req, res) => {
    const avisos = await readAvisos();
    res.json(avisos);
});

app.post('/api/avisos', requireAuth, upload.single('url_imagem'), async (req, res) => {
    if (!req.body.titulo || !req.body.descricao) {
        return res.status(400).json({ success: false, message: 'Título e descrição são obrigatórios.' });
    }
    const avisos = await readAvisos();
    const newAviso = {
        titulo: req.body.titulo,
        descricao: req.body.descricao,
        data_inicio: req.body.data_inicio,
        data_fim: req.body.data_fim,
        link: req.body.link || '',
        url_imagem: req.file ? getFullImageUrl(req, req.file.filename) : ''
    };
    avisos.push(newAviso);
    await writeAvisos(avisos);
    broadcastRefresh();
    res.status(201).json({ success: true, message: 'Aviso criado com sucesso!' });
});

app.put('/api/avisos/:index', requireAuth, upload.single('url_imagem'), async (req, res) => {
    const avisos = await readAvisos();
    const index = parseInt(req.params.index);
    if (index < 0 || index >= avisos.length) return res.status(404).json({ success: false, message: 'Aviso não encontrado.' });
    
    const avisoToUpdate = { ...avisos[index], ...req.body };
    if (req.file) {
        avisoToUpdate.url_imagem = getFullImageUrl(req, req.file.filename);
        // Lógica para remover imagem antiga, se necessário
    }
    avisos[index] = avisoToUpdate;
    await writeAvisos(avisos);
    broadcastRefresh();
    res.json({ success: true, message: 'Aviso atualizado com sucesso!' });
});

app.delete('/api/avisos/:index', requireAuth, async (req, res) => {
    const avisos = await readAvisos();
    const index = parseInt(req.params.index);
    if (index < 0 || index >= avisos.length) return res.status(404).json({ success: false, message: 'Aviso não encontrado.' });
    
    avisos.splice(index, 1);
    await writeAvisos(avisos);
    broadcastRefresh();
    res.json({ success: true, message: 'Aviso removido com sucesso!' });
});

// =======================================================
// 9. INICIALIZAÇÃO DO SERVIDOR
// =======================================================
server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP e WebSocket rodando em http://localhost:${PORT}`);
    console.log(`🔑 Acesse a administração em http://localhost:${PORT}/admin/login`);
});