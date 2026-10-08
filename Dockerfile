FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ocr/package.json ./packages/ocr/package.json
RUN npm ci
COPY frontend ./frontend
COPY vite.config.mjs ./
COPY packages/ocr ./packages/ocr
COPY scripts/pack-ocr.js ./scripts/pack-ocr.js
RUN npm run build && npm run package:ocr

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ocr/package.json ./packages/ocr/package.json
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS platform
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/artifacts ./artifacts
COPY backend ./backend
COPY packages/ocr/backend/modules/ocr/catalog.js ./packages/ocr/backend/modules/ocr/catalog.js
COPY server.js package.json ./
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s CMD ["node","-e","fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

FROM node:22-bookworm-slim AS ocr-license
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY backend/shared ./backend/shared
COPY backend/infrastructure/rate-limit-store.js ./backend/infrastructure/rate-limit-store.js
COPY services/shared ./services/shared
COPY services/ocr-license ./services/ocr-license
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s CMD ["node","-e","fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "services/ocr-license/server.js"]

FROM node:22-bookworm-slim AS ocr-demo
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 MALLOC_ARENA_MAX=2
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY backend/shared ./backend/shared
COPY backend/infrastructure/rate-limit-store.js ./backend/infrastructure/rate-limit-store.js
COPY services/shared ./services/shared
COPY services/ocr-demo ./services/ocr-demo
COPY packages/ocr ./packages/ocr
COPY package.json ./
RUN node -e "require('./packages/ocr/backend/modules/ocr/engine-loader').loadEngine()"
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s CMD ["node","-e","fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "services/ocr-demo/server.js"]

FROM python:3.12-slim-bookworm AS gst-service
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 GST_PYTHON=python3 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 MALLOC_ARENA_MAX=2
WORKDIR /app
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY services/gst/requirements.txt ./services/gst/requirements.txt
RUN pip install --no-cache-dir -r services/gst/requirements.txt && useradd --uid 10001 --create-home app
COPY --from=dependencies /app/node_modules ./node_modules
COPY backend/shared ./backend/shared
COPY backend/infrastructure/rate-limit-store.js ./backend/infrastructure/rate-limit-store.js
COPY services/shared ./services/shared
COPY services/gst ./services/gst
COPY package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s CMD ["node","-e","fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "services/gst/server.js"]
