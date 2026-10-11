# gitlab-runner

Runner propio de GitLab CI para el proyecto `barbershop-saas` (y cualquier otro
que se le asigne). Corre en **home-server** como contenedor docker con el socket
de Docker montado: el executor `docker` levanta cada job como contenedor hermano
(imagen por defecto `node:20`, igual que el CI del repo).

Motivo: benchmark 2026-10-11 — los 2 jobs del pipeline bajan de ~90 s (shared
runners) a 45–67 s, y los runners propios no consumen los 400 compute-minutes
del tier free de gitlab.com.

## Setup (una vez por registro nuevo)

```bash
cd ~/services/gitlab-runner
cp .env.example .env      # y pegar el RUNNER_TOKEN (glrt-…) de GitLab

set -a; . ./.env; set +a
docker compose run --rm gitlab-runner register --non-interactive \
  --url https://gitlab.com --token "$RUNNER_TOKEN" \
  --executor docker --docker-image node:20 \
  --description "home-server docker runner"

# Ajustar concurrencia (jobs en paralelo sobre 4c/8t) y levantar
sed -i 's/^concurrent = .*/concurrent = 2/' data/config/config.toml
docker compose up -d
```

El token queda persistido en `data/config/config.toml` (gitignored); `.env`
solo se usa al registrar.

## Operación

```bash
docker compose ps                       # estado
docker compose logs -f                  # logs (toma/release de jobs)
docker compose pull && docker compose up -d   # actualizar el runner
docker system prune -af                 # si el disco aprieta (imágenes/caches viejos)
```

Ver estado en GitLab: proyecto → Settings → CI/CD → Runners (debe figurar
"online"), o `glab api projects/<PROJECT_ID>/runners`.

## Notas

- Runner **locked** al proyecto y con tag `home-server`, pero corre jobs sin tag
  (untagged): se lleva todo el pipeline del proyecto; los shared runners de
  gitlab.com quedan solo como testigo. Si home-server está caído, los jobs
  quedan pending hasta que vuelva (sin fallback automático a shared).
- Disco: cada job descarga dependencias en el volumen de builds del runner y
  se limpia al terminar; el cache npm persiste en el volumen de cache.
- En omarchy este servicio NO está levantado (enable por-máquina): solo corre
  en home-server (`cd ~/services/gitlab-runner && docker compose up -d`).
