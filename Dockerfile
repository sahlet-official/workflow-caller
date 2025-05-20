# Build
# https://hub.docker.com/layers/library/node/23-alpine/images/sha256-a6399af5418a73b9483a8d374964ce1dfc70e8c51664f22149868f1feccfa5c2
FROM node@sha256:a6399af5418a73b9483a8d374964ce1dfc70e8c51664f22149868f1feccfa5c2 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Setup
# https://hub.docker.com/layers/library/node/23-alpine/images/sha256-a6399af5418a73b9483a8d374964ce1dfc70e8c51664f22149868f1feccfa5c2
FROM node@sha256:a6399af5418a73b9483a8d374964ce1dfc70e8c51664f22149868f1feccfa5c2

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev --production && npm cache clean --force 
RUN rm -rf /usr/share/man /usr/share/doc /var/cache/apk/*

COPY --from=builder /app/dist ./dist

# Run command
CMD ["node", "dist/app.js"]
