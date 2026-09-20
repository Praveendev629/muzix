FROM node:20-slim

# Install dependencies + deno for yt-dlp JS challenges
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip ffmpeg curl ca-certificates unzip && \
    curl -fsSL https://deno.land/install.sh | sh && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    pip3 install --break-system-packages yt-dlp[default] 2>/dev/null || true && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV DENO_INSTALL=/root/.deno
ENV PATH="$DENO_INSTALL/bin:$PATH"

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
