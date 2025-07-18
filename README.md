# Painel Informativo Web (Digital Signage)

![Logo](public/logo.png)

Este projeto é um sistema de sinalização digital (Digital Signage) baseado na web, construído com Node.js e Express. Ele permite a criação e gerenciamento de telas informativas que exibem conteúdo dinâmico, como notícias de feeds RSS e avisos internos. O sistema foi projetado para ser flexível, escalável e compatível com diversos dispositivos que possuam um navegador web.

O projeto nasceu da necessidade de substituir um script Python limitado ao Windows, buscando uma solução moderna e multiplataforma para a divulgação de informações na universidade.

## Funcionalidades Principais

- **Painel de Administração:** Uma interface web segura para gerenciar todo o sistema.
- **Gerenciamento de Telas:** Crie, edite e exclua múltiplas telas de exibição.
- **Configuração por Tela:** Cada tela pode ter suas próprias fontes de conteúdo e configurações.
- **Gerenciamento de Avisos:** Um CRUD completo para criar avisos com título, descrição, período de validade e imagem. Avisos são exibidos automaticamente durante seu período de vigência.
- **Layouts Flexíveis:**
  - **Layout A:** Exibição completa com imagem, título, data, descrição e QR Code para o link da notícia.
  - **Layout B:** Exibição só de imagens, ideal para avisos.
  - **Layout C:** Exibição dinâmica (todos os layouts juntos)
  - **Layout D:** Exibição de calendário.
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
- **`googleapi`:** Para busca de dados de agendas.
- **`outras...`:** Consulte arquivo package.json para visualizar as outras bibliotecas utilizadas.

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
├── .env                   # Arquivo de senhas
├── avisos.json            # "Banco de dados" para os avisos
├── content-manager.js     # Lógica para buscar e processar conteúdo
├── db.json                # "Banco de dados" para as telas
├── Dockerfile             # Define a imagem Docker da aplicação
├── docker-compose.yml     # Orquestra o container para deploy facilitado
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

2.  **Se necessário crie os arquivos de dados iniciais para evitar erros de volume no Docker.:**
    ```bash
    touch db.json avisos.json
    ```

3.  **Suba o serviço com o Docker Compose:**
    ```bash
    docker-compose up -d
    docker-compose up --build -d (para atualizar o serviço já em funcionamento, lembre-se de copiar as pastas uploads e arquivos json e .env)
    ```

4.  **Acesse a aplicação:**
    - O servidor estará rodando em `http://localhost:3000` (ou no seu IP). 
    - **Painel de Administração:** Acesse `http://localhost:3000/admin/login`
    - **Telas de Exibição:** Serão acessíveis através de URLs como `http://localhost:3000/display/[ID_DA_TELA]`.

## Uso do Painel de Administração

### Login
- **Usuário Padrão:** `admin`
- **Senha Padrão:** `admin`
*Recomenda-se alterar essas credenciais diretamente no arquivo `.env` para um ambiente de produção.*

### Dashboard
Após o login, você verá o dashboard principal, que lista todas as telas criadas. A partir daqui, você pode:
- **Adicionar Nova Tela:** Inicia o processo de criação de uma nova tela de exibição.
- **Gerenciar Avisos:** Leva para a interface de gerenciamento de avisos.
- **Forçar Atualização de Telas:** Envia um comando para que todas as telas públicas abertas recarreguem seu conteúdo imediatamente.

### Criando/Editando uma Tela
- **Nome da Tela:** Um nome descritivo (ex: "Tela da Biblioteca", "Painel do Auditório").
- **Fontes de Conteúdo:**
  - **Selecionar suas fontes:** Escolha e marque a fonte que deseja exibir.
- **Configurações de Exibição:**
  - **Layout:** Escolha o layout visual para a tela.
  - **Intervalo do Carrossel:** Tempo em segundos que cada slide ficará visível.

### Gerenciando Avisos
Na página de avisos, você pode realizar operações de CRUD (Criar, Ler, Atualizar, Deletar) para os avisos.
- **Título e Descrição:** Conteúdo principal do aviso.
- **Data de Início e Fim:** Período em que o aviso estará ativo e será exibido nas telas configuradas para isso.
- **Imagem e Link:** Campos opcionais para enriquecer o aviso.
- **Seletor de Telas** Campo de seleção para quais telas deverão aparecer os avisos.


## Próximos Passos e Melhorias Futuras

- [ ] Melhorar organização e comentários do código.
- [ ] Melhorar Gerenciamento de Dados (race condition)
- [ ] Permitir a configuração de múltiplas fontes de conteúdo (mais de um feed RSS) por tela.
- [ ] Implementar estratégias de cache inteligentes com Service Worker. (Exige HTTPS)
- [ ] Implementar HTTPS com Certificado Autoassinado (o certificado tem que ser instalado manualmente em cada dispositivo)
---

*Este projeto foi desenvolvido por TI FCT.*