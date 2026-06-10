# Деплой Phoenix Vault на password.avtch.io

Сервер `tamirlan@10.10.10.17` (доступ через VPN), публичный IP `89.106.236.230`.
На сервере уже работает Avatracker: его контейнер `avatracker_nginx` владеет
портами 80/443 и обслуживает `avatracker.online`. Мы не трогаем его трафик —
просто дописываем ему ещё один виртуальный хост.

Целевая схема:

```
Браузер ──HTTPS──> 89.106.236.230 (проброс 80/443) ──> 10.10.10.17
                                                         │
                                          avatracker_nginx (80/443, TLS)
                                          ├── avatracker.online      → стек Avatracker (как было)
                                          └── password.avtch.io     → phoenix-nginx (docker-сеть)
                                                                        │
                                                              phoenix nginx (фронт + статика)
                                                              ├── /api, /admin → web:8000 (gunicorn)
                                                              └── db (postgres:16, volume)
```

Phoenix-стек наружу не публикуется (только `127.0.0.1:8088` для отладки);
avatracker_nginx ходит к нему напрямую по docker-сети под именем `phoenix-nginx`.

---

## Шаг 0. DNS

В панели регистратора домена `avtch.io` добавить A-запись:

| Тип | Имя (host) | Значение | TTL |
|-----|------------|----------|-----|
| A | `password` | `89.106.236.230` | 300–3600 |

Проверка: `nslookup password.avtch.io` → `89.106.236.230`.

Порты 80/443 с публичного IP уже проброшены на этот сервер — Avatracker
открывается из интернета, значит проброс работает.

## Шаг 1. Зайти на сервер и получить код

```bash
# подключить VPN
ssh tamirlan@10.10.10.17

cd ~
git clone <URL-репозитория> phoenix
cd phoenix
```

## Шаг 2. Настроить .env

```bash
cp scripts/.env.production.example .env
nano .env
```

Обязательно заполнить:

- `DJANGO_SECRET_KEY` — сгенерировать: `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`
- `POSTGRES_PASSWORD` — свой пароль БД
- `EMAIL_HOST_PASSWORD` — пароль приложения для `info@avtch.io`
  (иначе временно `EMAIL_NOTIFICATIONS_ENABLED=False`)
- при необходимости `AVATRACKER_API_TOKEN`, `PUBLIC_SUPPORT_EMAIL`

Адреса (`password.avtch.io`, порт `8088`) в шаблоне уже прописаны.

## Шаг 3. Проверить имя docker-сети Avatracker

```bash
docker inspect avatracker_nginx --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{println}}{{end}}'
```

Если вывод — `avatracker-back_avatracker_network`, ничего менять не надо.
Если другое имя — поправь `networks.avatracker.name` в
[docker-compose.avatracker-net.yml](../docker-compose.avatracker-net.yml).

## Шаг 4. Поднять Phoenix-стек

```bash
docker compose -f docker-compose.ssh.yml -f docker-compose.avatracker-net.yml up -d --build
docker compose -f docker-compose.ssh.yml -f docker-compose.avatracker-net.yml ps   # web/db/nginx healthy
curl http://127.0.0.1:8088/api/health/live/                                        # бэкенд жив
```

Миграции и collectstatic выполняются автоматически при старте.

Проверить, что avatracker_nginx видит наш контейнер по сети:

```bash
docker exec avatracker_nginx sh -c 'wget -qO- http://phoenix-nginx/api/health/live/ || curl -s http://phoenix-nginx/api/health/live/'
# должен вернуть JSON health-чека
```

## Шаг 5. (Опционально) Ключи шифрования секретов

```bash
docker compose -f docker-compose.ssh.yml -f docker-compose.avatracker-net.yml exec web python manage.py generate_rsa_keypair
```

Ключи лягут в docker-том `phoenix_keys` — **сделай резервную копию приватного
ключа**, без него зашифрованные пароли не расшифровать.

## Шаг 6. Vhost: этап 1 — HTTP для выпуска сертификата

Конфиги avatracker_nginx лежат на хосте в `~/avatracker-back/nginx/conf.d/`.
Сначала ставим HTTP-only версию (443-блок нельзя включать, пока нет сертификата —
`nginx -t` упадёт):

```bash
cat > ~/avatracker-back/nginx/conf.d/password.avtch.io.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name password.avtch.io;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
EOF

docker exec avatracker_nginx nginx -t && docker exec avatracker_nginx nginx -s reload
```

`nginx -s reload` не прерывает работу Avatracker.

## Шаг 7. Выпустить сертификат

Avatracker уже использует certbot с webroot-волюмами — выпускаем сертификат
в те же волюмы:

```bash
docker run --rm \
  -v avatracker-back_certbot_conf:/etc/letsencrypt \
  -v avatracker-back_certbot_www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d password.avtch.io --email info@avtch.io --agree-tos --no-eff-email
```

Успех = `Successfully received certificate` и путь
`/etc/letsencrypt/live/password.avtch.io/`.

## Шаг 8. Vhost: этап 2 — полный конфиг с HTTPS

```bash
cp ~/phoenix/deploy/avatracker-nginx-password.avtch.io.conf \
   ~/avatracker-back/nginx/conf.d/password.avtch.io.conf

docker exec avatracker_nginx nginx -t && docker exec avatracker_nginx nginx -s reload
```

## Шаг 9. Продление сертификата

Посмотри, как Avatracker продлевает свой сертификат:

```bash
docker ps -a | grep -i certbot
grep -B2 -A10 certbot ~/avatracker-back/docker-compose*.yml
```

- Если в стеке Avatracker есть certbot-контейнер с циклом `renew` — он продлевает
  **все** сертификаты в волюме, включая новый. Убедись только, что nginx
  перезагружается после продления (ищи `nginx -s reload` в его compose).
- Если продление руками/через cron — добавь в `crontab -e`:

```
0 4 * * 1 docker run --rm -v avatracker-back_certbot_conf:/etc/letsencrypt -v avatracker-back_certbot_www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot && docker exec avatracker_nginx nginx -s reload
```

## Шаг 10. Суперпользователь и проверка

```bash
docker compose -f docker-compose.ssh.yml -f docker-compose.avatracker-net.yml exec web python manage.py createsuperuser
```

Открыть в браузере:

- https://password.avtch.io — фронтенд
- https://password.avtch.io/admin/ — Django admin
- https://password.avtch.io/api/health/live/ — health check
- https://avatracker.online — убедиться, что Avatracker работает как раньше

---

## Эксплуатация

**Обновление версии:**

```bash
cd ~/phoenix
git pull
docker compose -f docker-compose.ssh.yml -f docker-compose.avatracker-net.yml up -d --build
```

**Логи:**

```bash
docker compose -f docker-compose.ssh.yml -f docker-compose.avatracker-net.yml logs -f web
docker logs -f avatracker_nginx
```

**Бэкап / восстановление БД** (скрипты в `scripts/`):

```bash
./scripts/backup_db.sh
./scripts/restore_db.sh <файл-дампа>
```

Стоит добавить в cron, например ежедневно в 03:00:
`0 3 * * * cd /home/tamirlan/phoenix && ./scripts/backup_db.sh`

## Типовые проблемы

| Симптом | Причина / решение |
|---|---|
| certbot: challenge failed | DNS ещё не обновился, или http-vhost из шага 6 не подхвачен (`docker exec avatracker_nginx nginx -T \| grep password`) |
| 502 на password.avtch.io | Phoenix-стек не поднят или не в сети Avatracker: проверка из шага 4 (`wget http://phoenix-nginx/...`) |
| 400 Bad Request от Django | Хоста нет в `DJANGO_ALLOWED_HOSTS` в `.env`; после правки перезапустить `up -d` |
| CSRF ошибка при логине | `DJANGO_CSRF_TRUSTED_ORIGINS=https://password.avtch.io` в `.env`; также проверь, что в deploy/nginx.conf не перетирается `X-Forwarded-Proto` (в репо уже исправлено) |
| Открывается Avatracker вместо Phoenix | vhost не подхвачен — `nginx -t` + `nginx -s reload` в контейнере avatracker_nginx |
| После рестарта phoenix-стека 502 не уходит | resolver-кеш nginx держит старый IP до 30 с — подождать или `docker exec avatracker_nginx nginx -s reload` |
| Письма не уходят | Пустой `EMAIL_HOST_PASSWORD` или провайдер режет исходящий 465 порт — использовать `RESEND_API_KEY` |
