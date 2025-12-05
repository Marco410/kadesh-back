ARG NODE_VERSION=18.17.0

# --- Base --- #
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /code

RUN apt-get -qy update \
    && apt-get -qy install openssl gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget
RUN yarn add global if-env

# --- Dependencies --- #
FROM base AS deps

ARG IS_BUILDING=true
ARG SESSION_SECRET=a_secret_session_key_that_is_at_least_32_characters_long

COPY ./ .
RUN SKIP_POSTINSTALL=1 yarn install --prod --frozen-lockfile
RUN yarn add faker
RUN yarn build

# --- Final --- #
FROM base AS prod

WORKDIR /code

COPY --from=deps /code/node_modules node_modules
COPY --from=deps /code/.keystone .keystone
COPY ./ .

RUN npx puppeteer browsers install chrome
EXPOSE 3000
ENTRYPOINT ["yarn", "start"]