#!/bin/sh
set -eu

: "${EDGE_SHARED_SECRET:?EDGE_SHARED_SECRET is required}"
: "${TRUSTED_CLIENT_CIDRS:?TRUSTED_CLIENT_CIDRS is required}"
: "${HAPROXY_BASIC_AUTH_USER:?HAPROXY_BASIC_AUTH_USER is required}"
: "${HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT:?HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT is required}"

HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT=$(printf '%s' "$HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT" | sed 's/\$\$/\$/g')

printf '%s\n' "$TRUSTED_CLIENT_CIDRS" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed '/^$/d' > /tmp/trusted_cidrs.acl

envsubst '${EDGE_SHARED_SECRET} ${HAPROXY_BASIC_AUTH_USER} ${HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT}' \
  < /usr/local/etc/haproxy/haproxy.cfg.template \
  > /tmp/haproxy.cfg

exec haproxy -W -db -f /tmp/haproxy.cfg
