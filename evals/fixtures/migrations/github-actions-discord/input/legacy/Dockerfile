FROM node:24-alpine

ADD package.json package-lock.json /
RUN npm ci --omit=dev
ADD entrypoint.js /
RUN chmod +x /entrypoint.js

ENTRYPOINT ["node", "/entrypoint.js"]
