# CalmCarry API — single-stage build (node:20 has the toolchain better-sqlite3 needs).
FROM node:20
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/main.js"]
