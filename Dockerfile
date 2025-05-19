# FROM node:23-alpine AS builder

# WORKDIR /app

# COPY package*.json ./
# RUN npm ci

# COPY tsconfig.json ./
# COPY src ./src

# RUN npm run build

# Setup
FROM node:23-alpine

# WORKDIR /app

# COPY package*.json ./
# RUN npm ci --omit=dev && \
#     npm cache clean --force && \
#     rm -rf /usr/share/man /usr/share/doc /var/cache/apk/*

# COPY --from=builder /app/dist ./dist

# # Run command
# CMD ["node", "dist/app.js"]
