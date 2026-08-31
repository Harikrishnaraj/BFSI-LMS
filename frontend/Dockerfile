# Build from the repo root: docker build -f frontend/Dockerfile .
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_* values are inlined at build time, so they must be present here
# rather than only at runtime.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
COPY --from=deps /app/node_modules node_modules
COPY package.json package-lock.json ./
COPY frontend frontend
RUN npm run build --workspace frontend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/frontend/.next frontend/.next
COPY --from=build /app/frontend/public frontend/public
COPY --from=build /app/frontend/package.json frontend/
COPY --from=build /app/frontend/next.config.mjs frontend/
USER node
EXPOSE 3000
WORKDIR /app/frontend
CMD ["../node_modules/.bin/next", "start"]
