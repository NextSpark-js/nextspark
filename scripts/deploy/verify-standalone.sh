#!/usr/bin/env bash
#
# verify-standalone.sh - deploy a new project as `output: 'standalone'` and check it from a directory with no checkout
#
# Packs the packages from this tree (or takes the tarballs of an earlier pack), creates a starter project from them,
# migrates a PostgreSQL database, builds with `output: 'standalone'`, copies the standalone output, `.next/static` and
# `public/` to a separate directory (the recipe in 14-deployment/01-deployment-overview), hides the project, and runs
# `node server.js` there. Then it checks:
#   mode A  the server alone on http://localhost:<port>
#   mode B  the same server behind a Node TLS proxy that sends X-Forwarded-Proto: https (what nginx does)
# Each mode checks health, public pages, static assets, sign-in by one-time code (a local stand-in for Resend), a protected
# page with the session, a write, the write-origin rules and sign-out. Mode B adds what only the proxy and https change: the
# absolute https redirect, the Secure cookies, and the origin rules for a wrong scheme, a forged X-Forwarded-Host and a Referer.
# Exit: 0 all checks passed, 1 a step or check failed, 2 usage error or missing tool.
#
# USAGE: scripts/deploy/verify-standalone.sh [--packages DIR] [--work DIR] [--logs DIR] [--skip-proxy] [--keep]
#   --packages DIR  use the 12 tarballs in DIR instead of packing (the CI job passes the ones its pack job built)
#   --work DIR      scratch directory (default: a new directory under $TMPDIR); removed on success unless --keep.
#                   Must be outside this repository, or Node would resolve modules from the checkout.
#   --logs DIR      where the logs go (default: <work>/logs)
#   --skip-proxy    mode A only
#   --keep          keep the scratch directory on success too
#
# ENVIRONMENT
#   PGHOST (localhost), PGPORT (5432), PGUSER ($USER), PGPASSWORD (none): a PostgreSQL where this user can create and drop databases
#   STANDALONE_PORT_BASE (3990): ports base (app), base+1 (mode B app), base+2 (proxy), base+3 (fake Resend)
#   STANDALONE_DB_PREFIX (standalone_ci): the databases are <prefix>_a and <prefix>_b, dropped at the end
#   NODE and pnpm come from PATH. Needs openssl and curl. Servers are stopped by PID.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SUPPORT="$REPO_ROOT/scripts/deploy/standalone-support.mjs"
PACKAGES="" WORK="" LOGS="" SKIP_PROXY=false KEEP=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --packages) PACKAGES="$2"; shift 2 ;;
    --work) WORK="$2"; shift 2 ;;
    --logs) LOGS="$2"; shift 2 ;;
    --skip-proxy) SKIP_PROXY=true; shift ;;
    --keep) KEEP=true; shift ;;
    -h | --help) sed -n '2,/^set -uo/p' "$0" | sed '$d'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

BASE=${STANDALONE_PORT_BASE:-3990}
PORT_A=$BASE PORT_B=$((BASE + 1)) PORT_PROXY=$((BASE + 2)) PORT_RESEND=$((BASE + 3))
DB_PREFIX=${STANDALONE_DB_PREFIX:-standalone_ci}
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-$(whoami)}

for tool in curl openssl psql createdb dropdb pg_dump node pnpm; do
  command -v "$tool" > /dev/null || { echo "[standalone] ERROR: $tool is not installed" >&2; exit 2; }
done
if [[ -n "$WORK" ]]; then
  case $WORK in /*) ;; *) WORK="$PWD/$WORK" ;; esac
  case "$WORK/" in "$REPO_ROOT"/*) echo "[standalone] ERROR: --work must be outside $REPO_ROOT" >&2; exit 2 ;; esac
else
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/standalone-ci.XXXXXX")"
fi
mkdir -p "$WORK"; WORK="$(cd "$WORK" && pwd)"
[[ -n "$LOGS" ]] || LOGS="$WORK/logs"
mkdir -p "$LOGS"; LOGS="$(cd "$LOGS" && pwd)"
PIDS=()
FAILED=0 TOTAL=0

log() { echo "[standalone] $*"; }
die() { echo "[standalone] ERROR: $*" >&2; FAILED=$((FAILED + 1)); finish 1; }

stop_pid() { # stop_pid <pid>: by PID only
  kill "$1" 2>/dev/null || return 0
  for _ in $(seq 1 20); do kill -0 "$1" 2>/dev/null || return 0; sleep 0.25; done
  kill -9 "$1" 2>/dev/null || true
}
forget_pid() { # forget_pid <pid>: a stopped pid must not be signalled again (it may be reused)
  local p keep=()
  for p in ${PIDS[@]+"${PIDS[@]}"}; do [[ "$p" == "$1" ]] || keep+=("$p"); done
  PIDS=(${keep[@]+"${keep[@]}"})
}
stop_servers() {
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do stop_pid "$pid"; done
  PIDS=()
}
FINISHED=false
finish() { # finish <code>: runs once, from die, from the end of the script and from the EXIT trap
  [[ $FINISHED == true ]] && return
  FINISHED=true
  stop_servers
  for suffix in a b; do dropdb --if-exists "${DB_PREFIX}_$suffix" >/dev/null 2>&1 || true; done
  if [[ $1 -eq 0 && $KEEP != true ]]; then
    rm -rf "$WORK"
  else
    log "work directory kept: $WORK (logs: $LOGS)"
  fi
  exit "$1"
}
trap 'finish $?' EXIT
trap 'exit 1' INT TERM   # the EXIT trap then cleans up

# --- checks -----------------------------------------------------------------------------------------------------------
LABEL=""
row() { # row <check> <expected> <got>
  TOTAL=$((TOTAL + 1))
  if [[ "$2" == "$3" ]]; then echo "$LABEL | $1 | $2 | $3 | PASS"; else echo "$LABEL | $1 | $2 | $3 | FAIL"; FAILED=$((FAILED + 1)); fi
}
code() { curl -s ${CURL[@]+"${CURL[@]}"} -o /dev/null -w '%{http_code}' --max-time 60 "$@"; }

signin() { # signin <base> <jar> <email>: one-time code from the fake Resend; prints "send=<code> otp=<found|missing> signin=<code>"
  local base=$1 jar=$2 email=$3 origin otp r1 r2
  origin=$(echo "$base" | sed -E 's#(https?://[^/]+).*#\1#')
  r1=$(curl -s ${CURL[@]+"${CURL[@]}"} -c "$jar" -b "$jar" -o /dev/null -w '%{http_code}' -X POST "$base/api/auth/email-otp/send-verification-otp" \
    -H "Origin: $origin" -H 'content-type: application/json' -d "{\"email\":\"$email\",\"type\":\"sign-in\"}")
  otp=""
  for _ in $(seq 1 20); do   # the email may be sent in the background: up to 10 s
    otp=$(curl -s "http://127.0.0.1:$PORT_RESEND/last?to=$email" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const m=JSON.parse(s);const x=((m&&m.subject)||"").match(/(\d{6})/);console.log(x?x[1]:"")}catch{console.log("")}})')
    [[ -n "$otp" ]] && break
    sleep 0.5
  done
  r2=$(curl -s ${CURL[@]+"${CURL[@]}"} -c "$jar" -b "$jar" -o /dev/null -w '%{http_code}' -X POST "$base/api/auth/sign-in/email-otp" \
    -H "Origin: $origin" -H 'content-type: application/json' -d "{\"email\":\"$email\",\"otp\":\"$otp\"}")
  echo "send=$r1 otp=$([[ -n "$otp" ]] && echo found || echo missing) signin=$r2"
}

run_checks() { # run_checks <label> <base-url> [curl args]
  LABEL=$1; local base=$2; shift 2; CURL=("$@")
  local jar="$LOGS/$LABEL.jar" origin team p n bad c
  rm -f "$jar"
  origin=$(echo "$base" | sed -E 's#(https?://[^/]+).*#\1#')

  for p in / /login /signup /docs /support /robots.txt /favicon.ico /api/health; do row "GET $p" 200 "$(code "$base$p")"; done
  row "GET /dashboard (no cookie)" 307 "$(code "$base/dashboard")"
  row "GET /superadmin (no cookie)" 307 "$(code "$base/superadmin")"
  row "GET /dashboard/tasks (no cookie)" 307 "$(code "$base/dashboard/tasks")"
  row "GET /api/v1/users/me (no cookie)" 401 "$(code "$base/api/v1/users/me")"
  curl -s ${CURL[@]+"${CURL[@]}"} "$base/login" | grep -o '/_next/static/[^"\\ ]*\.\(js\|css\)' | sort -u > "$LOGS/$LABEL-assets.txt"
  n=0; bad=0
  while read -r p; do n=$((n + 1)); c=$(code "$base$p"); [[ "$c" == 200 ]] || bad=$((bad + 1)); done < "$LOGS/$LABEL-assets.txt"
  row "_next/static assets ($n found on /login) not 200" 0 "$bad"
  [[ $n -gt 0 ]] || row "_next/static assets found on /login" ">0" 0
  row "GET /sitemap.xml" 200 "$(code "$base/sitemap.xml")"
  row "public/uploads/README.md" 200 "$(code "$base/uploads/README.md")"
  row "public/theme font" 200 "$(code "$base/theme/fonts/InterVariable.woff2")"
  row "docs page read from the filesystem" 200 "$(code "$base/docs/overview/introduction")"

  row "sign-in by one-time code" "send=200 otp=found signin=200" "$(signin "$base" "$jar" "standalone-$LABEL@example.com")"
  row "GET /dashboard (cookie)" 200 "$(code -b "$jar" "$base/dashboard")"
  row "GET /dashboard/tasks (cookie)" 200 "$(code -b "$jar" "$base/dashboard/tasks")"
  row "GET /dashboard/settings (cookie)" 200 "$(code -b "$jar" "$base/dashboard/settings")"
  row "GET /api/v1/users/me (cookie)" 200 "$(code -b "$jar" "$base/api/v1/users/me")"
  team=$(curl -s ${CURL[@]+"${CURL[@]}"} -b "$jar" "$base/api/v1/teams" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).data[0].id)}catch{console.log("")}})')
  row "team of the signed-in user" found "${team:+found}"
  row "POST /api/v1/tasks (cookie, own origin)" 201 "$(code -b "$jar" -X POST "$base/api/v1/tasks" -H "Origin: $origin" -H "x-team-id: $team" -H 'content-type: application/json' -d '{"title":"standalone task"}')"
  row "POST /api/v1/tasks (cookie, foreign origin)" 403 "$(code -b "$jar" -X POST "$base/api/v1/tasks" -H "Origin: https://evil.example" -H "x-team-id: $team" -H 'content-type: application/json' -d '{"title":"evil"}')"
  row "POST /api/v1/tasks (cookie, no Origin, JSON)" 201 "$(code -b "$jar" -X POST "$base/api/v1/tasks" -H "x-team-id: $team" -H 'content-type: application/json' -d '{"title":"no origin"}')"
  row "POST /api/v1/tasks (cookie, no Origin, form body)" 403 "$(code -b "$jar" -X POST "$base/api/v1/tasks" -H "x-team-id: $team" -H 'content-type: text/plain' -d '{"title":"form"}')"
  row "GET /api/v1/tasks (cookie)" 200 "$(code -b "$jar" -H "x-team-id: $team" "$base/api/v1/tasks")"
  row "POST sign-out" 200 "$(code -b "$jar" -c "$jar" -X POST "$base/api/auth/sign-out" -H "Origin: $origin" -H 'content-type: application/json' -d '{}')"
  row "GET /api/v1/users/me (after sign-out)" 401 "$(code -b "$jar" "$base/api/v1/users/me")"
  row "GET /dashboard (after sign-out)" 307 "$(code -b "$jar" "$base/dashboard")"
}

# what only the proxy and https change; B_BASE is the https address, CURL has -k
run_proxy_checks() { # run_proxy_checks <https-base>
  LABEL=B; local base=$1 origin jar="$LOGS/B-secure.jar" email="standalone-B-secure@example.com" hdr team p
  origin=$(echo "$base" | sed -E 's#(https?://[^/]+).*#\1#')
  rm -f "$jar"
  # Next builds the redirect from X-Forwarded-Proto: without the header the Location would be http://
  row "GET /dashboard (no cookie) redirects to an https URL" "$origin/" "$(curl -s -k -o /dev/null -w '%{redirect_url}' --max-time 60 "$base/dashboard" | cut -c1-$((${#origin} + 1)))"
  # sign-in again, keeping the response headers of the last step to read the cookies
  curl -s -k -c "$jar" -b "$jar" -o /dev/null -X POST "$base/api/auth/email-otp/send-verification-otp" \
    -H "Origin: $origin" -H 'content-type: application/json' -d "{\"email\":\"$email\",\"type\":\"sign-in\"}"
  local otp=""
  for _ in $(seq 1 20); do
    otp=$(curl -s "http://127.0.0.1:$PORT_RESEND/last?to=$email" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const m=JSON.parse(s);const x=((m&&m.subject)||"").match(/(\d{6})/);console.log(x?x[1]:"")}catch{console.log("")}})')
    [[ -n "$otp" ]] && break
    sleep 0.5
  done
  hdr=$(curl -s -k -D - -c "$jar" -b "$jar" -o /dev/null -X POST "$base/api/auth/sign-in/email-otp" \
    -H "Origin: $origin" -H 'content-type: application/json' -d "{\"email\":\"$email\",\"otp\":\"$otp\"}" | tr -d '\r')
  row "session cookie is __Secure-, HttpOnly, Secure" ok "$(echo "$hdr" | grep -i '^set-cookie: __Secure-better-auth.session_token=' | grep -qi '; HttpOnly' && echo "$hdr" | grep -i '^set-cookie: __Secure-better-auth.session_token=' | grep -qi '; Secure' && echo ok)"
  row "no session cookie without Secure" 0 "$(echo "$hdr" | grep -i '^set-cookie: .*better-auth.session' | grep -vic '; Secure')"
  team=$(curl -s -k -b "$jar" "$base/api/v1/teams" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).data[0].id)}catch{console.log("")}})')
  w() { code -b "$jar" -X POST "$base/api/v1/tasks" -H "x-team-id: $team" -H 'content-type: application/json' -d '{"title":"proxy"}' "$@"; }
  row "POST (Origin with the wrong scheme, http)" 403 "$(w -H "Origin: http://${origin#https://}")"
  row "POST (X-Forwarded-Host evil + app Origin)" 201 "$(w -H "X-Forwarded-Host: evil.example" -H "Origin: $origin")"
  row "POST (X-Forwarded-Host evil + Origin evil)" 403 "$(w -H "X-Forwarded-Host: evil.example" -H "Origin: https://evil.example")"
  row "POST (Referer of the app, no Origin)" 201 "$(w -H "Referer: $origin/dashboard")"
  row "POST (Referer evil, no Origin)" 403 "$(w -H "Referer: https://evil.example/x")"
}

# --- servers ----------------------------------------------------------------------------------------------------------
wait_for() { # wait_for <url> [curl args]: up to 90 s, ready only on a 2xx (a proxy answering 502 is not ready)
  local url=$1; shift
  for _ in $(seq 1 90); do curl -fs "$@" -o /dev/null --max-time 5 "$url" && return 0; sleep 1; done
  return 1
}
start_server() { # start_server <env-file> <port> <log> <pid-file>: node server.js from the deploy directory, env from the file only
  ( cd "$WORK/deploy" && set -a && . "$1" && set +a && export PORT="$2" HOSTNAME=127.0.0.1 && exec node server.js ) > "$3" 2>&1 &
  echo $! > "$4"; PIDS+=("$!")
}
urlenc() { node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"; }
write_env() { # write_env <file> <public-url> <db> <ip-source>; user and password are percent-encoded: the file is also sourced by sh
  cat > "$1" <<EOT
DATABASE_URL=postgresql://$(urlenc "$PGUSER")${PGPASSWORD:+:$(urlenc "$PGPASSWORD")}@$PGHOST:$PGPORT/$3?sslmode=disable
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=$2
NEXT_PUBLIC_APP_URL=$2
NODE_ENV=production
NEXTSPARK_AUTH_RUNTIME_ONLY=email,google
RESEND_API_KEY=re_standalone0000000000000000000000
RESEND_FROM_EMAIL=noreply@example.com
RESEND_BASE_URL=http://127.0.0.1:$PORT_RESEND
NEXTSPARK_CLIENT_IP_SOURCE=$4
EOT
  [[ $4 != xff ]] || echo "NEXTSPARK_TRUSTED_PROXY_HOPS=1" >> "$1"
}

# --- 1. packages and project --------------------------------------------------------------------------------------------
# an empty user config keeps the install independent of the machine's npm settings
: > "$WORK/empty.npmrc"; export NPM_CONFIG_USERCONFIG="$WORK/empty.npmrc" CYPRESS_INSTALL_BINARY=0
START=$SECONDS
if [[ -z "$PACKAGES" ]]; then
  log "packing the packages from $REPO_ROOT"
  PACKAGES="$WORK/packages"
  SKIP_MOBILE_VERIFY=1 "$REPO_ROOT/scripts/packages/pack.sh" --all --clean --output "$PACKAGES" > "$LOGS/pack.log" 2>&1 || { tail -30 "$LOGS/pack.log"; die "pack failed"; }
fi
COUNT=$(ls "$PACKAGES"/*.tgz 2>/dev/null | wc -l | tr -d ' ')
log "$COUNT tarballs in $PACKAGES"
[[ $COUNT -eq 12 ]] || die "expected 12 tarballs, found $COUNT"
rm -rf "$WORK/project"; mkdir -p "$WORK/project"; ln -sfn "$PACKAGES" "$WORK/project/.packages"
[[ -f "$REPO_ROOT/packages/create-nextspark-app/dist/index.js" ]] || die "packages/create-nextspark-app/dist is missing (pack builds it)"
log "creating the starter from the tarballs"
( cd "$WORK/project" && node "$REPO_ROOT/packages/create-nextspark-app/dist/index.js" app --preset saas --theme starter --type web --name app --slug app --description "Standalone check" -y < /dev/null ) > "$LOGS/create.log" 2>&1 \
  || { tail -30 "$LOGS/create.log"; die "create failed"; }
APP="$WORK/project/app"

# --- 2. database, migrate, build with output: 'standalone' ---------------------------------------------------------------
dropdb --if-exists "${DB_PREFIX}_a" >/dev/null 2>&1; createdb "${DB_PREFIX}_a" || die "cannot create database ${DB_PREFIX}_a (PGHOST=$PGHOST PGUSER=$PGUSER)"
write_env "$WORK/a.env" "http://localhost:$PORT_A" "${DB_PREFIX}_a" none
cp "$WORK/a.env" "$APP/.env"
log "migrating"
( cd "$APP" && pnpm db:migrate ) > "$LOGS/migrate.log" 2>&1 || { tail -30 "$LOGS/migrate.log"; die "db:migrate failed"; }
# the documented way (14-deployment/01-deployment-overview): output: 'standalone' in next.config.mjs
node -e "
const fs = require('fs'); const f = process.argv[1]; const s = fs.readFileSync(f, 'utf8');
const t = s.replace(/^(\s*)basePath,\$/m, \"\$1basePath,\n\$1output: 'standalone',\");
if (t === s) { console.error('basePath, line not found in next.config.mjs'); process.exit(1) }
fs.writeFileSync(f, t)" "$APP/next.config.mjs" || die "cannot enable output: 'standalone'"
grep -q "output: 'standalone'" "$APP/next.config.mjs" || die "output: 'standalone' is not in next.config.mjs"
log "building"
( cd "$APP" && pnpm build ) > "$LOGS/build.log" 2>&1 || { tail -40 "$LOGS/build.log"; die "build failed"; }
[[ -f "$APP/.next/standalone/server.js" ]] || die "the build wrote no .next/standalone/server.js"

# --- 3. copy to a separate directory and hide the project -----------------------------------------------------------------
mkdir -p "$WORK/deploy/.next"
cp -R "$APP/.next/standalone/." "$WORK/deploy/" || die "cannot copy .next/standalone"
cp -R "$APP/.next/static" "$WORK/deploy/.next/static" || die "cannot copy .next/static"
cp -R "$APP/public" "$WORK/deploy/public" || die "cannot copy public/"
rm -f "$WORK/deploy/.env" "$WORK/deploy/.env.production"   # Next copies the loaded .env; the server gets its variables from the environment
mv "$APP" "$WORK/project/app.hidden" || die "cannot hide the project directory"
# no link of the deploy may lead out of it (back to the project or the checkout); links that do not resolve cannot
LABEL=deploy
row "no symlink in deploy/ resolves outside it" 0 "$(find "$WORK/deploy" -type l | node -e '
const fs = require("fs"); const root = fs.realpathSync(process.argv[1]); let s = ""; let bad = 0;
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  for (const l of s.split("\n").filter(Boolean)) { let t; try { t = fs.realpathSync(l) } catch { continue } if (t !== root && !t.startsWith(root + "/")) bad++ }
  console.log(bad) })' "$WORK/deploy")"
log "deployed to $WORK/deploy ($(du -sh "$WORK/deploy" | cut -f1)); build took $((SECONDS - START)) s"

# --- 4. fake Resend, mode A --------------------------------------------------------------------------------------------
node "$SUPPORT" resend "$PORT_RESEND" > "$LOGS/fake-resend.log" 2>&1 &
PIDS+=("$!")
wait_for "http://127.0.0.1:$PORT_RESEND/all" || die "the fake Resend did not start"

log "mode A: node server.js on http://localhost:$PORT_A"
start_server "$WORK/a.env" "$PORT_A" "$LOGS/server-a.log" "$WORK/a.pid"
wait_for "http://localhost:$PORT_A/api/health" || { tail -30 "$LOGS/server-a.log"; die "standalone server (mode A) did not answer"; }
run_checks A "http://localhost:$PORT_A" > "$LOGS/checks-a.log"; cat "$LOGS/checks-a.log"
stop_pid "$(cat "$WORK/a.pid")"; forget_pid "$(cat "$WORK/a.pid")"

# --- 5. mode B: the same server behind a TLS proxy --------------------------------------------------------------------------
if [[ $SKIP_PROXY != true ]]; then
  B_START=$SECONDS
  log "mode B: node server.js on 127.0.0.1:$PORT_B behind a TLS proxy on https://localhost:$PORT_PROXY"
  createdb "${DB_PREFIX}_b" || die "cannot create database ${DB_PREFIX}_b"
  # a fresh database needs the migrations too: copy the migrated one
  pg_dump "${DB_PREFIX}_a" | psql -q -v ON_ERROR_STOP=1 "${DB_PREFIX}_b" > "$LOGS/copy-db.log" 2>&1 || { tail -20 "$LOGS/copy-db.log"; die "cannot copy the migrated database"; }
  mkdir -p "$WORK/tls"
  openssl req -x509 -newkey rsa:2048 -nodes -keyout "$WORK/tls/key.pem" -out "$WORK/tls/cert.pem" -days 2 -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" > /dev/null 2>&1 || die "cannot create the TLS certificate"
  write_env "$WORK/b.env" "https://localhost:$PORT_PROXY" "${DB_PREFIX}_b" xff
  start_server "$WORK/b.env" "$PORT_B" "$LOGS/server-b.log" "$WORK/b.pid"
  wait_for "http://127.0.0.1:$PORT_B/api/health" || { tail -30 "$LOGS/server-b.log"; die "standalone server (mode B) did not answer"; }
  node "$SUPPORT" proxy "$PORT_PROXY" "$PORT_B" "$WORK/tls/cert.pem" "$WORK/tls/key.pem" > "$LOGS/proxy.log" 2>&1 &
  PIDS+=("$!")
  wait_for "https://localhost:$PORT_PROXY/api/health" -k || { tail -30 "$LOGS/server-b.log" "$LOGS/proxy.log"; die "standalone server behind the proxy (mode B) did not answer"; }
  { run_checks B "https://localhost:$PORT_PROXY" -k; run_proxy_checks "https://localhost:$PORT_PROXY"; } > "$LOGS/checks-b.log"; cat "$LOGS/checks-b.log"
  log "mode B took $((SECONDS - B_START)) s"
fi

echo
log "$((TOTAL - FAILED)) of $TOTAL checks passed in $((SECONDS - START)) s"
if [[ $FAILED -gt 0 ]]; then echo "[standalone] FAILED: $FAILED check(s)"; finish 1; fi
finish 0
