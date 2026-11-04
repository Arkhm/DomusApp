FROM node:22-alpine AS development
WORKDIR /usr/src/app
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci
RUN npx prisma generate
COPY . .
EXPOSE 3333
CMD ["npm", "run", "dev"]

FROM development AS build
RUN npm run build
# O client gerado deve sobreviver à remoção das ferramentas de desenvolvimento.
# Prisma declara a CLI e TypeScript como peers opcionais; omitir dev sozinho os preserva.
RUN npm prune --omit=dev --omit=optional && npm cache clean --force
RUN node -e "const fs = require('node:fs'); require('@prisma/client'); for (const name of ['prisma', 'typescript', 'tsx']) { if (fs.existsSync('node_modules/' + name)) throw new Error('Ferramenta de desenvolvimento presente: ' + name); }"

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=build --chown=node:node /usr/src/app/package*.json ./
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --from=build --chown=node:node /usr/src/app/docs ./docs
USER node
EXPOSE 3333
CMD ["npm", "start"]
