FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache de layer)
COPY package.json ./
RUN npm install --omit=dev

# Copia apenas o servidor
COPY server.js ./

# .env NÃO é copiado — passe via variável de ambiente ou volume
# Exemplo de run:
#   docker run -d --env-file .env -p 3001:3001 --name oral-sin-capi oral-sin-capi
# Exemplo com volume (edita o .env sem rebuild):
#   docker run -d -v $(pwd)/.env:/app/.env -p 3001:3001 --name oral-sin-capi oral-sin-capi

EXPOSE 3001

# Reinicia em caso de crash com --restart=unless-stopped no docker run
CMD ["node", "server.js"]
