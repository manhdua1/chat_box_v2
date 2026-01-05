# ChatBox Frontend - Docker Image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Install serve to run the production build
RUN npm install -g serve

# Expose port
EXPOSE 5173

# Serve the built files
CMD ["serve", "-s", "dist", "-p", "5173"]
