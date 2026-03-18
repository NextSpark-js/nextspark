# NextSpark Studio — Guía de Deploy en VPS

## Estado actual (Hostinger VPS — 31.97.168.92)

### Servidor
- **IP**: `31.97.168.92`
- **OS**: Ubuntu 24.04 LTS (Linux 6.8.0, x86_64)
- **Ruta del proyecto**: `/root/nextspark/`
- **SSH alias local**: `ssh hostinger` (configurado en `~/.ssh/config`)

### Contenedores Docker
| Nombre | Imagen | Puertos |
|--------|--------|---------|
| `nextspark-studio-1` | `nextspark-studio` (build local) | `127.0.0.1:4000`, `5500-6999` |
| `nextspark-caddy-1` | `caddy:2-alpine` | `0.0.0.0:80`, `0.0.0.0:443`, `127.0.0.1:2019` |
| `nextspark-postgres-1` | `postgres:16-alpine` | `127.0.0.1:5432` |

---

## Arquitectura: Preview Proxy (Caddy + basePath)

Los previews de proyectos corren como `next dev` en puertos dinámicos (5500–5999) dentro del container Studio. Para que las cookies de sesión funcionen (mismo origin), Caddy hace proxy de `/p/{puerto}/` al servidor correspondiente.

```
Usuario → :80 → Caddy
  ├── /p/5542/...  → studio:5542  (preview dev server del proyecto)
  └── /*           → studio:4000  (Studio app principal)
```

### Variables de entorno para cada preview (generadas automáticamente)
```env
DATABASE_URL=postgresql://studio:<pass>@postgres:5432/studio_{slug}
BETTER_AUTH_SECRET=<auto-generado>
BETTER_AUTH_URL=http://<VPS_IP>               # Origin ONLY — sin basePath
NEXT_PUBLIC_APP_URL=http://<VPS_IP>/p/{port}  # Con basePath (para el cliente)
NEXT_BASE_PATH=/p/{port}                      # Inyectado en next.config.mjs
NODE_ENV=development
```

### Bugs críticos ya corregidos (no repetir)

1. **`__NEXT_PRIVATE_STANDALONE_CONFIG` leak** (commit `56361cf`):
   Studio corre en modo standalone, que setea esta variable de entorno. Al spawnar el preview `next dev`, si se heredaba con `...process.env`, el worker usaba la config de Studio en vez de evaluar el `next.config.mjs` del proyecto.
   **Fix**: filtrar variables `__NEXT_PRIVATE_*` antes de pasarlas al child process.

2. **Better Auth basePath conflict** (commit `3d04f12`):
   Better Auth extrae el basePath del router desde `new URL(ctx.baseURL).pathname`. Si `BETTER_AUTH_URL` incluye el Next.js basePath (ej. `/p/5556`), las rutas nunca matchean porque Next.js ya stripea el basePath de `request.url` antes de que los handlers lo vean.
   **Fix**: `BETTER_AUTH_URL` debe ser solo el origin (ej. `http://31.97.168.92`). Usar `NEXT_PUBLIC_APP_URL` para links de cara al usuario.

---

## Archivos de configuración

### `docker-compose.studio.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: studio
      POSTGRES_PASSWORD: StudioDB_2024!
      POSTGRES_DB: nextspark_studio
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U studio -d nextspark_studio"]
      interval: 5s
      timeout: 3s
      retries: 5

  studio:
    build:
      context: .
      dockerfile: apps/studio/Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://studio:StudioDB_2024!@postgres:5432/nextspark_studio
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - BETTER_AUTH_URL=http://<VPS_IP>        # ← Cambiar a la IP/dominio del VPS
      - NEXT_PUBLIC_APP_URL=http://<VPS_IP>    # ← Cambiar a la IP/dominio del VPS
      - STUDIO_REGISTRATION=invite
      - PORT=4000
      - NODE_ENV=production
    volumes:
      - studio_projects:/app/studio-projects
    ports:
      - "127.0.0.1:4000:4000"
      - "5500-5999:5500-5999"
      - "6000-6999:6000-6999"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      - studio
    ports:
      - "80:80"
      - "443:443"
      - "127.0.0.1:2019:2019"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  pg_data:
  studio_projects:
  caddy_data:
  caddy_config:
```

### `Caddyfile` (HTTP)

```caddyfile
{
  admin :2019
}

:80 {
  @preview path_regexp preview ^/p/(\d+)(.*)$
  handle @preview {
    reverse_proxy studio:{re.preview.1} {
      transport http {
        dial_timeout 120s
        response_header_timeout 120s
      }
    }
  }

  reverse_proxy studio:4000
}
```

### `Caddyfile` (HTTPS con dominio)

```caddyfile
{
  admin :2019
}

tu-dominio.com {
  @preview path_regexp preview ^/p/(\d+)(.*)$
  handle @preview {
    reverse_proxy studio:{re.preview.1} {
      transport http {
        dial_timeout 120s
        response_header_timeout 120s
      }
    }
  }

  reverse_proxy studio:4000
}
```

### `.env` (en la raíz del proyecto en el VPS)

Variables sensibles que docker-compose lee vía `${VAR}`:

```env
GITHUB_CLIENT_ID=<tu-github-client-id>
GITHUB_CLIENT_SECRET=<tu-github-client-secret>
CLAUDE_CODE_OAUTH_TOKEN=<tu-claude-oauth-token>
BETTER_AUTH_SECRET=<generado-con-openssl-rand-hex-32>
ANTHROPIC_API_KEY=sk-ant-<tu-key>
```

> **Nota**: Este archivo NO se commitea. Las variables `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` y `DATABASE_URL` están hardcodeadas en `docker-compose.studio.yml` y deben actualizarse directamente ahí con la nueva IP/dominio.

---

## Deploy en un VPS nuevo

### Prerrequisitos

- Ubuntu 22.04 o 24.04
- Docker + Docker Compose instalados
- Git instalado
- Puertos abiertos: `80`, `443` (y `5500-6999` para previews)
- GitHub OAuth App configurada
- Anthropic API Key
- Claude Code OAuth Token

### Paso 1: Instalar Docker (si no está instalado)

```bash
curl -fsSL https://get.docker.com | sh
```

### Paso 2: Clonar el repositorio

```bash
git clone https://github.com/NextSpark-js/nextspark.git /root/nextspark
cd /root/nextspark
```

### Paso 3: Crear el archivo `.env`

```bash
cat > /root/nextspark/.env << EOF
GITHUB_CLIENT_ID=<tu-github-client-id>
GITHUB_CLIENT_SECRET=<tu-github-client-secret>
CLAUDE_CODE_OAUTH_TOKEN=<tu-claude-oauth-token>
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
ANTHROPIC_API_KEY=sk-ant-<tu-key>
EOF
```

### Paso 4: Actualizar la IP en docker-compose.studio.yml

```bash
NEW_IP="<nueva-ip-o-dominio>"
sed -i "s/31\.97\.168\.92/$NEW_IP/g" docker-compose.studio.yml
```

### Paso 5: Build y levantar los contenedores

```bash
docker compose -f docker-compose.studio.yml up -d --build
```

> El build tarda ~10–15 minutos la primera vez (compila Next.js en modo standalone).

### Paso 6: Verificar que todo corre

```bash
docker compose -f docker-compose.studio.yml ps
docker logs nextspark-studio-1 --tail=50
```

### Paso 7: Primer acceso

- URL: `http://<nueva-ip>`
- El primer registro crea la cuenta admin (modo `invite` — solo se permite un registro)

### Paso 8: Configurar GitHub OAuth App

En GitHub → Settings → Developer Settings → OAuth Apps, actualizar:
- **Homepage URL**: `http://<nueva-ip>`
- **Callback URL**: `http://<nueva-ip>/api/auth/callback/github`

---

## Migración de datos desde el VPS anterior

### 1. Exportar bases de datos (en el VPS origen)

```bash
# DB principal del Studio
docker exec nextspark-postgres-1 pg_dump -U studio nextspark_studio > /tmp/nextspark_studio.sql

# DBs de proyectos generados
for db in $(docker exec nextspark-postgres-1 psql -U studio -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'studio_%';"); do
  db=$(echo $db | xargs)
  docker exec nextspark-postgres-1 pg_dump -U studio $db > /tmp/${db}.sql
done

# Comprimir todo
tar -czf /tmp/studio-dbs-backup.tar.gz /tmp/nextspark_studio.sql /tmp/studio_*.sql
```

### 2. Exportar proyectos generados (código fuente)

```bash
docker run --rm \
  -v nextspark_studio_projects:/data \
  -v /tmp:/backup \
  alpine tar -czf /backup/studio-projects-backup.tar.gz -C /data .
```

### 3. Copiar archivos al nuevo VPS

```bash
# Desde tu máquina local
scp hostinger:/tmp/studio-dbs-backup.tar.gz ./
scp hostinger:/tmp/studio-projects-backup.tar.gz ./

# Subir al nuevo VPS
scp studio-dbs-backup.tar.gz root@<nueva-ip>:/tmp/
scp studio-projects-backup.tar.gz root@<nueva-ip>:/tmp/
```

### 4. Importar en el nuevo VPS

```bash
# Extraer backups
cd /tmp && tar -xzf studio-dbs-backup.tar.gz

# Importar DB principal
docker exec -i nextspark-postgres-1 psql -U studio nextspark_studio < /tmp/nextspark_studio.sql

# Importar DBs de proyectos
for sql_file in /tmp/studio_*.sql; do
  db_name=$(basename $sql_file .sql)
  docker exec nextspark-postgres-1 createdb -U studio $db_name 2>/dev/null || true
  docker exec -i nextspark-postgres-1 psql -U studio $db_name < $sql_file
done

# Restaurar proyectos
docker run --rm \
  -v nextspark_studio_projects:/data \
  -v /tmp:/backup \
  alpine tar -xzf /backup/studio-projects-backup.tar.gz -C /data
```

---

## Comandos útiles en el VPS

```bash
# Ver logs del Studio en tiempo real
docker logs nextspark-studio-1 -f

# Reiniciar solo el Studio (sin rebuild)
docker compose -f docker-compose.studio.yml restart studio

# Rebuild completo y reiniciar
docker compose -f docker-compose.studio.yml up -d --build

# Conectarse al container Studio (Alpine — usar sh, no bash)
docker exec -it nextspark-studio-1 sh

# Ver logs de Caddy
docker logs nextspark-caddy-1 -f

# Ver todas las bases de datos
docker exec nextspark-postgres-1 psql -U studio -c '\l'

# Consultar usuarios del Studio
docker exec nextspark-postgres-1 psql -U studio -d nextspark_studio -c 'SELECT email, "createdAt" FROM "user" ORDER BY "createdAt";'

# Parar todos los contenedores
docker compose -f docker-compose.studio.yml down

# Parar y borrar volúmenes (DESTRUCTIVO — borra todos los datos)
docker compose -f docker-compose.studio.yml down -v

# Ver uso de disco de volúmenes
docker system df -v
```

---

## Notas del Dockerfile

El build es multi-stage (`apps/studio/Dockerfile`):

1. **Builder** (`node:20-alpine`): instala pnpm 9, copia workspaces, hace stubs de paquetes workspace no necesarios, copia templates de `packages/core/templates/`, compila en modo `standalone`.
2. **Runner** (`node:20-alpine`): instala `git`, `su-exec`, `pnpm`, `pm2`. Copia artefactos standalone. Crea usuario `studio` (non-root).

> **Importante**: El Claude Agent SDK requiere que el proceso corra como usuario no-root. El `docker-entrypoint.sh` ajusta permisos del volumen montado y hace `su-exec studio` antes de iniciar la app.

---

## SSH config local

Para el nuevo VPS, agregar entrada en `~/.ssh/config`:

```
Host <alias>
  HostName <nueva-ip>
  User root
  IdentityFile ~/.ssh/id_rsa
```
