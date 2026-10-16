FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Browser requests use relative URLs on the same website
ARG NEXT_PUBLIC_PREDICTION_API_URL=/api/prediction
ARG NEXT_PUBLIC_CAUSAL_API_URL=/api/causal

ENV NEXT_PUBLIC_PREDICTION_API_URL=$NEXT_PUBLIC_PREDICTION_API_URL
ENV NEXT_PUBLIC_CAUSAL_API_URL=$NEXT_PUBLIC_CAUSAL_API_URL

# Docker service addresses used by Next.js during the build
ARG CAUSYN_PREDICTION_UPSTREAM=http://prediction-api:8000
ARG CAUSYN_CAUSAL_UPSTREAM=http://causal-llm-api:8001

ENV CAUSYN_PREDICTION_UPSTREAM=$CAUSYN_PREDICTION_UPSTREAM
ENV CAUSYN_CAUSAL_UPSTREAM=$CAUSYN_CAUSAL_UPSTREAM
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
