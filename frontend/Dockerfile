# --- ESTÁGIO 1: Build (O Construtor) ---
FROM node:18-alpine AS build

WORKDIR /app

# Copia e instala dependências
COPY package.json package-lock.json ./
RUN npm install

# Copia o código e constrói o site
COPY . .
RUN npm run build

# --- ESTÁGIO 2: Produção (O Servidor) ---
FROM nginx:alpine

# Remove a configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia a nossa configuração personalizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia APENAS os arquivos estáticos gerados no estágio 1
# NOTA: Se seu projeto for Create-React-App antigo, mude "dist" para "build" abaixo
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]