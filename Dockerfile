FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json ./
RUN corepack enable && pnpm install

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN corepack enable && pnpm install --prod

COPY --from=build /app/dist ./dist
COPY --from=build /app/config/app.example.json ./config/app.example.json

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
