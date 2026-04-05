FROM alpine:3.20

RUN apk add --no-cache curl tzdata

COPY docker/ppr-cron/ppr.crontab /etc/crontabs/root
COPY docker/ppr-cron/run-ppr-daily.sh /usr/local/bin/run-ppr-daily.sh
COPY docker/ppr-cron/run-ppr-monthly.sh /usr/local/bin/run-ppr-monthly.sh

RUN chmod +x /usr/local/bin/run-ppr-daily.sh /usr/local/bin/run-ppr-monthly.sh

CMD ["crond", "-f", "-l", "2"]
