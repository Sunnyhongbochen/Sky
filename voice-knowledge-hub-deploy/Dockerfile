FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv python3-pip ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json requirements.txt ./
RUN python3 -m venv /app/.venv \
  && /app/.venv/bin/python -m pip install --no-cache-dir -r requirements.txt

COPY dist ./dist
COPY scripts ./scripts
COPY docs ./docs
RUN mkdir -p /app/data/uploads /app/data/models

ENV HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/data PYTHON_BIN=/app/.venv/bin/python WHISPER_MODEL=small
EXPOSE 4173
VOLUME ["/app/data"]

CMD ["npm", "start"]

