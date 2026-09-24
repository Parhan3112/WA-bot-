FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create volume mount points for data and auth info
VOLUME ["/app/data", "/app/auth_info_baileys"]

# Expose HTTP port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
