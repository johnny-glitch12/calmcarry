# CalmCarry API — single-stage build (node:20 has the toolchain better-sqlite3 needs).
FROM node:20
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# NODE_ENV is provided at runtime by fly.toml [env] (development for the demo,
# production for the real launch) — not baked into the image.
EXPOSE 4000
CMD ["node", "dist/main.js"]
