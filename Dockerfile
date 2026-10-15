FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.inc /etc/nginx/security-headers.inc
COPY . /usr/share/nginx/html

EXPOSE 80
