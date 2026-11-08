FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code and build
COPY . .
RUN npm run build

EXPOSE 5000

ENV PORT=5000
CMD ["node", "server/index.js"]
