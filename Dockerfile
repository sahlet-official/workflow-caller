# FROM node:23-alpine AS builder

# WORKDIR /app

# COPY package*.json ./
# RUN npm ci

# COPY tsconfig.json ./
# COPY src ./src

# RUN npm run build

# Setup
# FROM node:23-alpine
# FROM --platform=linux/arm64 node:23-alpine

# FROM node@sha256:a6399af5418a73b9483a8d374964ce1dfc70e8c51664f22149868f1feccfa5c2
FROM node@sha256:be56e91681a8ec1bba91e3006039bd228dc797fd984794a3efedab325b36e679
# FROM alpine:latest

# WORKDIR /app

# COPY package*.json ./
# RUN npm ci --omit=dev && \
#     npm cache clean --force && \
#     rm -rf /usr/share/man /usr/share/doc /var/cache/apk/*

# RUN npm ci --omit=dev --production && npm cache clean --force 
# RUN rm -rf /usr/share/man /usr/share/doc /var/cache/apk/*

# COPY --from=builder /app/dist ./dist

# # Run command
# CMD ["node", "dist/app.js"]
