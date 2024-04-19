# ---- Base Node ----
FROM amd64/node:16-buster

RUN echo "alias ll='ls -lah --color=auto'" >> ~/.bashrc
WORKDIR /app

ENV NODE_ENV=production

COPY ["package*.json", "./"]

#RUN apt-get update || : && apt-get install -y \
#    python3 \
#    build-essential \
#    git

#RUN npm config set python /usr/bin/python
#RUN npm rebuild bcrypt --build-from-source
RUN npm i


# START - Simulated binaries for testing
COPY src /app/src


RUN mkdir -p node_modules; chmod 777 node_modules; chown node:node -R .
USER node

ENTRYPOINT ["tail", "-f", "/dev/null"]