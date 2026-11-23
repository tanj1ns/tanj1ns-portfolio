FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install

COPY . .
RUN npm run build

ENV PORT=4000
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

EXPOSE 4000
CMD ["node", "server/index.js"]
