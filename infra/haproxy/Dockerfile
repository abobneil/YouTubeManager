FROM haproxy:2.9-alpine

USER root

RUN apk add --no-cache gettext

COPY haproxy.cfg.template /usr/local/etc/haproxy/haproxy.cfg.template
COPY docker-entrypoint.sh /usr/local/bin/ytm-haproxy-entrypoint.sh

RUN chmod +x /usr/local/bin/ytm-haproxy-entrypoint.sh

USER haproxy

ENTRYPOINT ["/usr/local/bin/ytm-haproxy-entrypoint.sh"]
