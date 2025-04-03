# --- Build Stage ---
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
# Using ci for cleaner installs, matching backend
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the React app for production
# Ensure your build script is named 'build' in package.json
RUN npm run build

# --- Production Stage ---
FROM nginx:stable-alpine

# Copy built assets from the builder stage
# Vite builds to a 'dist' directory by default
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration (if needed, or use default)
# We'll add a basic config to handle SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (default for Nginx)
# docker-compose.yml will map host 5173 to this container port 80
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"] 