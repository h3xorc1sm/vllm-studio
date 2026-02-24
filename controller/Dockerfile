FROM oven/bun:1.3.9

WORKDIR /app/controller

ENV HUSKY=0

COPY package.json bun.lock ./
RUN bun install

COPY . .

EXPOSE 8080

CMD ["bun", "src/main.ts"]
