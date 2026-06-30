FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist
COPY --from=build /app/config/app.example.json ./config/app.example.json
RUN ln -s /etc/secrets/app.json ./config/app.json

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
