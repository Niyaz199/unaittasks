FROM alpine:3.20

RUN apk add --no-cache curl tzdata

COPY docker/cron/archive-tasks.crontab /etc/crontabs/root
COPY docker/cron/run-archive.sh /usr/local/bin/run-archive.sh

RUN chmod +x /usr/local/bin/run-archive.sh

CMD ["crond", "-f", "-l", "2"]
