# Build from the repo root: docker build -f backend/Dockerfile .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# Install backend deps only; the frontend manifest is copied so npm can resolve
# the workspace tree without pulling in Next.
RUN npm ci --workspace backend --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/backend/node_modules backend/node_modules
COPY package.json package-lock.json ./
COPY backend backend
RUN npm run build --workspace backend \
 && npm run prisma:generate --workspace backend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY --from=build /app/backend/package.json backend/
USER node
EXPOSE 3001
CMD ["node", "backend/dist/src/server.js"]
