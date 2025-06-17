# Etapa 1: Definir a imagem base oficial do Node.js.
# Usaremos a versão 18-alpine, que é leve e segura.
FROM node:18-alpine

# Define o diretório de trabalho dentro do contêiner.
WORKDIR /usr/src/app

# Copia os arquivos de dependências primeiro para aproveitar o cache do Docker.
# Se package.json não mudar, o Docker não reinstala as dependências.
COPY package*.json ./

# Instala as dependências do projeto.
RUN npm install

# Copia o restante dos arquivos da aplicação para o diretório de trabalho.
COPY . .

# Expõe a porta que a aplicação Express usa dentro do contêiner.
EXPOSE 3000

# Define o comando padrão para iniciar a aplicação quando o contêiner rodar.
CMD [ "node", "server.js" ]