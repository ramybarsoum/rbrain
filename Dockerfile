FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "src/cli.ts", "serve", "--http"]
