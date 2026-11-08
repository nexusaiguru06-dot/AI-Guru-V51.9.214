# V51.9.173 — AI Guru for Google Cloud Run.
# Build:   gcloud builds submit --config cloudbuild.yaml   (or: docker build -t ai-guru .)
# The app listens on $PORT (Cloud Run sets it, 8080 by default).

# ---------- 1. install and build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 AI_GURU_STANDALONE=1
# V51.9.174: skip onnxruntime's extra GPU download (a dev tool's dependency; not used by the app)
ENV ONNXRUNTIME_NODE_INSTALL=skip
COPY package.json package-lock.json ./
COPY scripts/ai-guru-postinstall.mjs scripts/ai-guru-postinstall.mjs
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- 2. the small image that runs ----------
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
# OCR for scanned textbook pages (Material Studio): pdftoppm + Tesseract with English and Malayalam
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-mal ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1001 aiguru
COPY --from=build --chown=aiguru:aiguru /app/.next/standalone ./
COPY --from=build --chown=aiguru:aiguru /app/.next/static ./.next/static
COPY --from=build --chown=aiguru:aiguru /app/public ./public
# reference libraries the lessons read at run time (video DNA, styles, maths RAG); the saved data is NOT here —
# it is in PostgreSQL and Cloud Storage
COPY --from=build --chown=aiguru:aiguru /app/data ./data
USER aiguru
EXPOSE 8080
CMD ["node", "server.js"]
