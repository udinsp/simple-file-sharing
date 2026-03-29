FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

RUN mkdir -p files

EXPOSE 3000

USER node

CMD ["node", "server.js"]
