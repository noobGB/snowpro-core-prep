# syntax=docker/dockerfile:1
#
# Three stages, per the plan ("SnowPro Core Prep — Containerize"):
#   1. build the frontend (vite build -> static index.html + hashed assets)
#   2. install the pipeline/server's production-only dependencies
#   3. runtime: copy both in, run as the non-root `node` user, boot into pipeline/src/server.ts
#
# The pipeline's own output directory (SNOWPRO_CONTENT_OUTPUT=/app/content) is deliberately
# separate from the built frontend's directory (SNOWPRO_DIST_DIR=/app/dist) — see
# pipeline/src/write/output.ts and server.ts's own header comment for why sharing one directory
# would let a pipeline run delete the built frontend.

# ---- Stage 1: build the frontend ----
FROM node:24-alpine AS app-builder
WORKDIR /build/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build
# -> /build/app/dist/{index.html, assets/*}
# vite.config.ts's publicDir (../content) resolves to /build/content, which was never created in
# this stage, so the publicDir copy is a guaranteed no-op — this build can never embed stale
# generated JSON and can never go stale relative to the boot-time pipeline run.

# ---- Stage 2: pipeline/server production dependencies ----
FROM node:24-alpine AS pipeline-deps
WORKDIR /build/pipeline
COPY pipeline/package.json pipeline/package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 3: runtime ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    SNOWPRO_CONTENT_SOURCE=/content \
    SNOWPRO_CONTENT_OUTPUT=/app/content \
    SNOWPRO_DATA_DIR=/data \
    SNOWPRO_DIST_DIR=/app/dist

# /app itself (not recursively) must be node-writable too: writeOutput() creates its atomic-write
# temp directory as a sibling of /app/content, directly under /app, before renaming it into place —
# see pipeline/src/write/output.ts. Existing entries under /app (dist/, pipeline/) stay root-owned;
# only the directory's own write permission changes, so the app code itself stays untamperable by
# the runtime user.
RUN mkdir -p /content /data /app/content \
    && chown -R node:node /content /data \
    && chown node:node /app /app/content

COPY --from=pipeline-deps /build/pipeline/node_modules ./pipeline/node_modules
COPY pipeline/package.json pipeline/tsconfig.json ./pipeline/
COPY pipeline/src ./pipeline/src
COPY --from=app-builder /build/app/dist ./dist

USER node
EXPOSE 8080
CMD ["/app/pipeline/node_modules/.bin/tsx", "/app/pipeline/src/server.ts"]
