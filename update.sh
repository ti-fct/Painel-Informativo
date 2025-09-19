#!/bin/bash

# ==============================================================================
# SCRIPT DE ATUALIZAÇÃO AUTOMÁTICA PARA A APLICAÇÃO PAINEL INFORMATIVO
# Localização: /root/Painel-Informativo
# Repositório: https://github.com/ti-fct/Painel-Informativo.git
# ==============================================================================

# Faz o script parar imediatamente se algum comando falhar. Essencial para segurança!
set -e

echo -e "\033[1;34m--- INICIANDO ATUALIZAÇÃO DO PAINEL INFORMATIVO ---\033[0m"

# 1. CRIAR BACKUP DOS DADOS PERSISTENTES
# ------------------------------------------------------------------------------
echo -e "\033[1;33m>>> 1. Criando backup dos dados...\033[0m"
# O diretório de backups será criado um nível acima, em /root/
BACKUP_DIR="/root/Painel-Informativo-Backup/backup_$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$BACKUP_DIR"

# Copia os arquivos de dados se eles existirem
if [ -f ".env" ]; then cp .env "$BACKUP_DIR/"; fi
if [ -f "db.json" ]; then cp db.json "$BACKUP_DIR/"; fi
if [ -f "avisos.json" ]; then cp avisos.json "$BACKUP_DIR/"; fi
if [ -d "uploads" ]; then cp -r uploads "$BACKUP_DIR/"; fi

echo -e "\033[0;32mBackup criado com sucesso em: $BACKUP_DIR\033[0m"


# 2. GARANTIR QUE OS ARQUIVOS DE DADOS EXISTAM ANTES DO BUILD
# ------------------------------------------------------------------------------
# O Docker Compose pode falhar se os arquivos mapeados como volume não existirem.
# Este passo garante que eles existam, mesmo em uma primeira instalação.
echo -e "\033[1;33m>>> 2. Verificando a existência dos arquivos de dados...\033[0m"
touch db.json avisos.json
# Cria o .env a partir do .env.example se ele não existir
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  echo "Arquivo .env não encontrado. Copiando de .env.example..."
  cp .env.example .env
fi


# 3. PUXAR AS ÚLTIMAS ALTERAÇÕES DO GIT
# ------------------------------------------------------------------------------
echo -e "\033[1;33m>>> 3. Puxando as últimas alterações do Git (branch main)...\033[0m"
git pull origin main


# 4. RECONSTRUIR E REINICIAR OS CONTÊINERES
# ------------------------------------------------------------------------------
echo -e "\033[1;33m>>> 4. Reconstruindo e reiniciando os contêineres com Docker Compose...\033[0m"
# Usamos 'docker compose' (v2, sem hífen) que é o padrão mais novo. 
# Se der erro, troque para 'docker-compose'.
docker compose up --build -d


# 5. LIMPAR IMAGENS DOCKER ANTIGAS
# ------------------------------------------------------------------------------
echo -e "\033[1;33m>>> 5. Limpando imagens Docker antigas e não utilizadas...\033[0m"
docker image prune -f


# 6. FINALIZAÇÃO
# ------------------------------------------------------------------------------
echo -e "\033[1;32m--- ATUALIZAÇÃO CONCLUÍDA COM SUCESSO! ---\033[0m"
echo "O Painel Informativo está rodando com a versão mais recente."