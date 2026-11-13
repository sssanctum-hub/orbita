FROM node:24-alpine
WORKDIR /app
COPY server.mjs .
ENV DATABASE_PATH=/data/orbita.sqlite
EXPOSE 8080
CMD ["node", "server.mjs"]
