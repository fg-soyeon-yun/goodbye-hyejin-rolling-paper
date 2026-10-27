# ──────────────────────────────────────────────────────────────
# goodbye-haejin — Coolify 배포용 Dockerfile (Next.js standalone)
# ──────────────────────────────────────────────────────────────
# 빌드: docker build -t goodbye-haejin .
# 실행: docker run -p 3000:3000 goodbye-haejin
# ──────────────────────────────────────────────────────────────

# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Coolify 는 빌드에 NODE_ENV=production 을 주입한다 → 그대로면 설치가
# devDependencies(typescript 등)를 스킵해 빌드가 깨진다.
# 설치 단계에서만 development 로 덮어써 devDependencies 까지 설치되게 한다.
ENV NODE_ENV=development
# npm ci 가 아니라 npm install: Windows 에서 만든 package-lock.json 은 linux-musl 전용
# 선택적 네이티브 의존성을 누락해 npm ci 가 컨테이너(node:20-alpine)에서 깨진다.
RUN npm install --no-audit --no-fund

# Stage 2: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: runner (production, slim)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# /app/data 는 화면에서 남긴 카드 저장 경로(APP_DATA_DIR) — Coolify 영구볼륨이 마운트되므로
# 비루트 전환 전에 미리 만들고 소유권을 넘긴다.
ENV APP_DATA_DIR=/app/data
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && mkdir -p /app/data \
 && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Coolify Health Check Path: /api/healthz
CMD ["node", "server.js"]
