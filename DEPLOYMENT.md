# Deployment: Vercel + Render + Neon

This app is split across three managed services:

| Component | Host | URL shape |
| --- | --- | --- |
| Frontend (Next.js) | **Vercel** | `https://<project>.vercel.app` |
| Backend (Spring Boot) | **Render** | `https://<service>.onrender.com` |
| Database (Postgres) | **Neon** | `postgresql://...neon.tech/<db>?sslmode=require` |

The scrapper is **not** deployed to a managed service — run it locally/manually against Neon when needed (see the last section).

Because the frontend and backend are on **different sites**, auth relies on a cross-site cookie (`SameSite=None; Secure`) and CORS must name the exact frontend origin. The env vars below configure that.

---

## 1. Neon (database) — do this first

1. Create a Neon project and a database. Copy the connection string. You'll need it in two forms:
   - **psql/seed form:** `postgresql://<user>:<pass>@<host>/<db>?sslmode=require`
   - **JDBC form (for Render):** `jdbc:postgresql://<host>/<db>?sslmode=require` — **host only, no `user:pass@`** (credentials go in separate env vars; see the warning in §2). See [Database connection](#database-connection-ssl-channel-binding-and-pooling) for `sslmode` options and why to drop the copied `channel_binding`.
2. **Seed the demo data — once, before the backend ever starts.** The dump creates tables with plain `CREATE TABLE` (no `IF NOT EXISTS`), so it must run against an empty DB before Hibernate auto-creates anything.

   Use [`neon-seed.sql`](neon-seed.sql) (a Neon-sanitized copy of `demoData.sql` — the `OWNER TO postgres` and `\restrict` lines that fail on Neon have been stripped):

   ```bash
   psql "postgresql://<user>:<pass>@<host>/<db>?sslmode=require" -f neon-seed.sql
   ```

   > Use **`psql`**, not the Neon web SQL editor — the seed loads data via `COPY ... FROM stdin`, which the web editor can't handle.

   If you ever regenerate `neon-seed.sql` from a fresh `demoData.sql`, re-run the sanitizer in `scripts`/PowerShell that strips lines matching `OWNER TO postgres;` and `^\(un)?restrict`.

After seeding, the backend's `spring.jpa.hibernate.ddl-auto=update` will reconcile the existing schema on first boot (it won't drop your data).

---

## 2. Render (backend)

Create a **Web Service** → "Build and deploy from a Git repository".

- **Root Directory:** `backend`
- **Runtime:** Docker (the existing [`backend/Dockerfile`](backend/Dockerfile) is used automatically).
- **Health Check Path:** `/health`
- The app binds to Render's injected `$PORT` automatically (`server.port=${PORT:8080}`).

**Environment variables:**

| Key | Value |
| --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<neon-host>/<db>?sslmode=require` (use Neon's **direct** host, not `-pooler`; see SSL note below for `verify-full`) |
| `SPRING_DATASOURCE_USERNAME` | Neon user |
| `SPRING_DATASOURCE_PASSWORD` | Neon password |
| `JWT_SECRET_KEY` | your JWT secret |
| `JWT_EXP_TIME` | e.g. `259200000` (3 days in ms — match your current value) |
| `GEMINI_API_KEY` | your Gemini key (PDF prediction feature) |
| `FRONTEND_ORIGIN` | `https://<project>.vercel.app,https://*.vercel.app` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `None` |

> ⚠️ **Do NOT paste Neon's full connection string into `SPRING_DATASOURCE_URL`.** Neon copies a libpq string that embeds credentials (`postgresql://user:pass@host/db`). The PostgreSQL **JDBC driver does not accept `user:pass@` in the URL** — it reads the part after the first `:` as the port and fails with `invalid port number` / `Driver ... claims to not accept jdbcUrl`. The URL must contain **only** host + `/db` + `?sslmode=...`; put the user and password in the separate `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` vars. Example:
>
> ```
> SPRING_DATASOURCE_URL=jdbc:postgresql://ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
> SPRING_DATASOURCE_USERNAME=neondb_owner
> SPRING_DATASOURCE_PASSWORD=npg_xxxxxxxx
> ```

`FRONTEND_ORIGIN` is comma-separated and supports patterns — the `https://*.vercel.app` entry lets Vercel **preview** deployments talk to the backend too. Drop it if you want production-only.

> Note: Render's free tier spins the service down when idle; the first request after idle takes ~30–60s.

### Database connection: SSL, channel binding, and pooling

**SSL mode.** Neon requires TLS. Two working options for the backend:

- **`sslmode=require` (default, simplest).** Encrypts the connection without certificate verification. No extra config — this is what Neon's own JDBC examples use. It does *not* verify you're talking to the real Neon server (a theoretical MITM gap), which is acceptable for server-to-server traffic inside cloud infra.
- **`sslmode=verify-full` + `sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory` (hardened).** Also validates Neon's certificate + hostname. The `sslfactory` part is **required**: without it, the PostgreSQL JDBC driver's default `LibPQFactory` ignores Java's `cacerts` and instead looks for a root-cert *file* at `~/.postgresql/root.crt`, which doesn't exist in the container — you'll get `Could not open SSL root certificate file /root/.postgresql/root.crt`. `DefaultJavaSSLFactory` makes it validate against the JVM truststore (which already trusts Neon's CA), so no cert file is needed:

  ```
  ...neon.tech/neondb?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory
  ```

(`require` is also fine for the one-off `psql` seed — `psql`/libpq use the system CA bundle, so `verify-full` works there without extra flags, unlike JDBC.)

**Channel binding — omit it for the backend.** Neon often appends `channel_binding=require` to copied connection strings. The PostgreSQL **JDBC driver does not support channel binding**, so leave it out of `SPRING_DATASOURCE_URL` (it provides no benefit there and the driver may reject it). `verify-full` already covers the same MITM threat for JDBC. The scrapper's `psycopg2`/`asyncpg` *do* support it, so keeping it there is harmless.

**Connection pooling — not needed for the backend; use the direct endpoint.** Spring Boot uses **HikariCP**, a bounded client-side pool (default max 10 connections), so one Render instance holds far fewer connections than Neon's compute limit (~100s). Use Neon's **direct** host. Only switch to Neon's **pooled** endpoint (the `-pooler` host = PgBouncer in *transaction* mode) if you scale to many Render instances or add serverless DB clients — and if you do, append `&prepareThreshold=0` to the JDBC URL, since transaction-mode pooling breaks server-side prepared statements. Keep the **scrapper** on the direct endpoint regardless (asyncpg + PgBouncer would need `statement_cache_size=0`).

**Neon autosuspend (free tier).** The compute suspends after ~5 min idle and drops connections, so the first request after idle can be slow or occasionally error on a stale Hikari connection. Optional `application.properties` tuning to recycle connections before they go stale:

```properties
spring.datasource.hikari.max-lifetime=240000
spring.datasource.hikari.keepalive-time=120000
```

---

## 3. Vercel (frontend)

Import the repo and set **Root Directory** to `frontend`. Vercel auto-detects Next.js and ignores the Dockerfile.

> ⚠️ **Do not ship `output: "standalone"` to Vercel.** It builds a self-hosting `server.js` (needed only for the Docker image) and makes Vercel **404 on every route** even though the build succeeds. `next.config.mjs` already guards this with `process.env.VERCEL`, so standalone is emitted only for local/Docker builds, not on Vercel. If you ever hardcode `output: "standalone"`, expect site-wide 404s.

**Environment variable:**

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://<service>.onrender.com` (no trailing slash, no port) |

`NEXT_PUBLIC_*` is baked in at **build time**, so after you set/first learn the Render URL you must **redeploy** the frontend for it to take effect.

### Bootstrapping order (chicken-and-egg)

`FRONTEND_ORIGIN` (Render) needs the Vercel URL, and `NEXT_PUBLIC_API_BASE_URL` (Vercel) needs the Render URL. Order:

1. Seed Neon (§1).
2. Deploy Render — its URL is fixed at create time, so you can set `NEXT_PUBLIC_API_BASE_URL` next.
3. Deploy Vercel with `NEXT_PUBLIC_API_BASE_URL` = Render URL.
4. Set Render's `FRONTEND_ORIGIN` to the Vercel URL and let Render redeploy.

---

## 4. Verify

- Open the Vercel URL, sign up / log in. In DevTools → Application → Cookies, confirm `auth_token` is set with `Secure` and `SameSite=None`.
- Network tab: API calls go to `https://<service>.onrender.com/api/...` and return 200 (not CORS errors).
- A protected action (e.g. admin tariff edit) should work, proving the cookie is sent cross-site.

Common failures:
- **CORS error / login "works" but authed calls 401:** `FRONTEND_ORIGIN` doesn't match the Vercel origin exactly, or `COOKIE_SECURE`/`COOKIE_SAMESITE` aren't `true`/`None`.
- **`Driver ... claims to not accept jdbcUrl` / `invalid port number`:** you put `user:pass@` in `SPRING_DATASOURCE_URL`. Move credentials to the separate username/password env vars (see §2 warning).
- **`Could not open SSL root certificate file /root/.postgresql/root.crt`:** you used `sslmode=verify-full` (or `verify-ca`) without `&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory`. Add that param, or switch to `sslmode=require`.
- **DB connection refused/other SSL error:** wrong/missing `sslmode`, a stray `channel_binding=require` (unsupported by the JDBC driver), or pointing at the `-pooler` host without `&prepareThreshold=0`.

---

## 5. Scrapper (local/manual against Neon)

Not deployed. To run it against Neon, set these env vars (note the new `DB_SSLMODE`):

| Key | Value |
| --- | --- |
| `RDS_ENDPOINT` | Neon host |
| `RDS_PORT` | `5432` |
| `RDS_USERNAME` | Neon user |
| `RDS_PASSWORD` | Neon password |
| `RDS_DBNAME` | Neon db |
| `DB_SSLMODE` | `require` |

Use Neon's **direct** host for `RDS_ENDPOINT` (not the `-pooler` host) — `asyncpg`/`psycopg2` rely on prepared statements that PgBouncer's transaction mode breaks. Channel binding is supported by these drivers, so a `channel_binding=require` from Neon is fine to leave on here (unlike the JDBC backend).

```bash
cd scrapper
pip install -r requirements.txt
python main.py          # one-shot scrape
# or: uvicorn main:app --reload   # API on :8000 (/scrape, /status, /lock, /unlock)
```

---

## Local development (unchanged workflow)

`docker compose up --build` still runs the full stack locally. Your `.env` now uses these keys (note the renames from `FRONTEND_EC2_HOST` / `NEXT_PUBLIC_BACKEND_EC2_HOST`):

```
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
BACKEND_PORT=8080
FRONTEND_PORT=3000
JWT_SECRET_KEY=...
JWT_EXP_TIME=259200000
GEMINI_API_KEY=...
```

`compose.yaml` derives `FRONTEND_ORIGIN`, `COOKIE_SECURE=false`, `COOKIE_SAMESITE=Lax`, and `NEXT_PUBLIC_API_BASE_URL=http://localhost:${BACKEND_PORT}` for you, so local http auth keeps working.
