# Painel Informativo Web (Digital Signage)

![Logo](public/logo.png)

Este projeto é um sistema de sinalização digital (Digital Signage) baseado na web, construído com Node.js e Express. Ele permite a criação e gerenciamento de telas informativas que exibem conteúdo dinâmico, como notícias de feeds RSS e avisos internos. O sistema foi projetado para ser flexível, escalável e compatível com diversos dispositivos que possuam um navegador web.

O projeto nasceu da necessidade de substituir um script Python limitado ao Windows, buscando uma solução moderna e multiplataforma para a divulgação de informações na universidade.

## Funcionalidades Principais

- **Painel de Administração:** Uma interface web segura para gerenciar todo o sistema.
- **Gerenciamento de Telas:** Crie, edite e exclua múltiplas telas de exibição.
- **Configuração por Tela:** Cada tela pode ter suas próprias fontes de conteúdo e configurações.
  - Suporte a múltiplos feeds RSS.
  - Opção para incluir ou não avisos globais.
  - Intervalo do carrossel configurável.
- **Gerenciamento de Avisos:** Um CRUD completo para criar avisos com título, descrição, período de validade e imagem. Avisos são exibidos automaticamente durante seu período de vigência.
- **Layouts Flexíveis:**
  - **Layout A:** Exibição completa com imagem, título, data, descrição e QR Code para o link da notícia.
- **Atualização em Tempo Real:** Administradores podem forçar a atualização de todas as telas ativas com um único clique, graças à tecnologia WebSocket.
- **Persistência de Dados:** Configurações de telas e avisos são salvas em arquivos JSON, funcionando como um banco de dados simples.

## Tecnologias Utilizadas

### Backend
- **Node.js:** Ambiente de execução JavaScript no servidor.
- **Express.js:** Framework web para gerenciamento de rotas e da API.
- **EJS (Embedded JavaScript):** Template engine para renderizar HTML dinâmico.
- **Multer:** Middleware para lidar com upload de arquivos (imagens dos avisos).
- **`ws`:** Biblioteca para implementação do servidor WebSocket para atualizações em tempo real.
- **`rss-parser`:** Para analisar e extrair dados de feeds RSS.
- **`cheerio`:** Para fazer parsing de HTML (usado para limpar descrições de notícias).

### Frontend
- **HTML5 & CSS3:** Estrutura e estilização das páginas.
- **JavaScript (Vanilla):** Lógica do lado do cliente para o carrossel, chamadas de API e interações.
- **`qrcode.js`:** Biblioteca para gerar QR Codes dinamicamente no navegador.

## Estrutura do Projeto

```
/
├── public/                # Arquivos estáticos (CSS, JS do cliente, imagens)
│   ├── css/
│   ├── js/
│   └── logo.png
├── uploads/               # Pasta para as imagens dos avisos (criada automaticamente)
├── views/                 # Arquivos de template EJS
│   ├── partials/          # (Opcional) Partes reutilizáveis como header/footer
│   ├── ...
├── avisos.json            # "Banco de dados" para os avisos
├── content-manager.js     # Lógica para buscar e processar conteúdo
├── db.json                # "Banco de dados" para as telas
├── package.json           # Dependências e scripts do projeto
└── server.js              # Servidor principal (coração da aplicação)
```

## Instalação e Execução

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 14.x ou superior)
- [npm](https://www.npmjs.com/) (geralmente instalado com o Node.js)

### Passos

1.  **Clone o repositório:**
    ```bash
    git clone [URL_DO_SEU_REPOSITÓRIO]
    cd [NOME_DA_PASTA_DO_PROJETO]
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Execute o servidor:**
    ```bash
    node server.js
    ```

4.  **Acesse a aplicação:**
    - O servidor estará rodando em `http://localhost:3000`.
    - **Painel de Administração:** Acesse `http://localhost:3000/admin/login`
    - **Telas de Exibição:** Serão acessíveis através de URLs como `http://localhost:3000/display/[ID_DA_TELA]`.

## Uso do Painel de Administração

### Login
- **Usuário Padrão:** `admin`
- **Senha Padrão:** `admin`
*Recomenda-se alterar essas credenciais diretamente no arquivo `server.js` para um ambiente de produção.*

### Dashboard
Após o login, você verá o dashboard principal, que lista todas as telas criadas. A partir daqui, você pode:
- **Adicionar Nova Tela:** Inicia o processo de criação de uma nova tela de exibição.
- **Gerenciar Avisos:** Leva para a interface de gerenciamento de avisos.
- **Forçar Atualização (F5):** Envia um comando para que todas as telas públicas abertas recarreguem seu conteúdo imediatamente.

### Criando/Editando uma Tela
- **Nome da Tela:** Um nome descritivo (ex: "Tela da Biblioteca", "Painel do Auditório").
- **Fontes de Conteúdo:**
  - **Exibir Avisos Globais:** Marque para que esta tela mostre os avisos ativos.
  - **Exibir Notícias de Feed RSS:** Marque para ativar a busca por notícias. Os campos de URL e quantidade se tornarão visíveis e obrigatórios.
- **Configurações de Exibição:**
  - **Layout:** Escolha o layout visual para a tela (atualmente, "Layout A").
  - **Intervalo do Carrossel:** Tempo em milissegundos que cada slide (notícia ou aviso) ficará visível.

### Gerenciando Avisos
Na página de avisos, você pode realizar operações de CRUD (Criar, Ler, Atualizar, Deletar) para os avisos.
- **Título e Descrição:** Conteúdo principal do aviso.
- **Data de Início e Fim:** Período em que o aviso estará ativo e será exibido nas telas configuradas para isso.
- **Imagem e Link:** Campos opcionais para enriquecer o aviso.

## Próximos Passos e Melhorias Futuras

- [ ] Configurar Docker para ambiente de produção.
- [ ] Implementar um sistema de autenticação mais robusto e criptografia.
- [ ] Adicionar mais layouts de tela (ex: Layout B apenas com imagens, Layout C com vídeo e texto).
- [ ] Permitir a configuração de múltiplas fontes de conteúdo (mais de um feed RSS) por tela.
- [ ] Criar uma interface para visualizar logs de erros do servidor.
- [ ] Implementar quantas telas estão conectadas no dashboad.
- [ ] Melhorias no códgio e UX.



---

*Este projeto foi desenvolvido por TI FCT.*