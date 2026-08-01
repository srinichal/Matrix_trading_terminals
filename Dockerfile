# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm install

# Copy application source code
COPY . .

# Build the frontend assets and server bundle
RUN npm run build

# Stage 2: Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package.json
COPY package.json ./

# Install production dependencies only
RUN npm install --only=production

# Copy built dist directory from builder stage
COPY --from=builder /app/dist ./dist

# Expose server port
EXPOSE 3000

# Run the production server
CMD ["node", "dist/server.cjs"]
