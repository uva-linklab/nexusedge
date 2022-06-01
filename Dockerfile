FROM node:12-buster-slim
MAINTAINER Nabeel Nasir

RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    python \
    build-essential \
    libudev-dev \
    mosquitto \
    mosquitto-clients \
 && rm -rf /var/lib/apt/lists/*

COPY . /on-the-edge

WORKDIR /on-the-edge/platform

RUN npm install

RUN node device-manager/handlers/install-handlers.js

ENTRYPOINT ["node", "platform-manager.js"]
