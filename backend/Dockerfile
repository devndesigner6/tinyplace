FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY backend/package.json ./backend/
RUN cd backend && npm install

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/tsconfig.json ./
COPY backend/drizzle.config.ts ./
COPY backend/src ./src
COPY backend/drizzle ./drizzle
RUN npm run build

EXPOSE 8080
CMD ["node", "dist/index.js"]
