FROM node:18-alpine
WORKDIR /app
# ffmpeg — converts Groq TTS wav → OGG/Opus for Sam's WhatsApp voice replies.
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
