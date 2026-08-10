FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# The signaling service imports shared protocol validators and the built-in
# Redis broker from the frontend tree. Keep the image limited to those files.
COPY docker/signaling-healthcheck.mjs ./docker/signaling-healthcheck.mjs
COPY signaling ./signaling
COPY src/frontend/host ./src/frontend/host
COPY src/frontend/session ./src/frontend/session
COPY src/frontend/transport ./src/frontend/transport

ENV NODE_ENV=production
USER node
EXPOSE 8790

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["node", "docker/signaling-healthcheck.mjs"]

ENTRYPOINT ["node", "signaling/agent.mjs"]
CMD ["--bind", "0.0.0.0", "--port", "8790"]
