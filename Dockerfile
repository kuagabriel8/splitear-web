FROM node:20-slim

RUN apt-get update && apt-get install -y python3 --no-install-recommends && rm -rf /var/lib/apt/lists/* && ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
