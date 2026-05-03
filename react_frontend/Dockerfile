FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ARG REACT_APP_API_URL
ARG REACT_APP_ADMIN_PASSWORD=fst2026
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_ADMIN_PASSWORD=$REACT_APP_ADMIN_PASSWORD

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

RUN printf 'server {\n\
    listen 3000;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
