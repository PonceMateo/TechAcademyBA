# syntax=docker/dockerfile:1

# Node 22 LTS for the development mode server. design.md pins Python and PostgreSQL but does
# not pin Node: 22 is the choice made here and it has to be confirmed by the team.
FROM node:22-slim

# NODE_ENV=development so that npm install does not skip devDependencies.
ENV NODE_ENV=development \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

WORKDIR /app

# package.json arrives with work unit 5. npm install is used instead of npm ci on purpose:
# there is no committed lockfile yet. Once package-lock.json exists, switching to npm ci is
# a one-line change that makes builds reproducible.
#
# The installed modules live in /app/node_modules. docker-compose.yml masks that path with a
# named volume, because the bind mount of the source would otherwise hide them on the host.
COPY package.json ./
RUN npm install

# The application source arrives through the bind mount declared in docker-compose.yml.
EXPOSE 5173

# Vite serves the development server with hot reload. The host flag is added by the compose
# service so the server listens on every interface of the container.
CMD ["npm", "run", "dev"]