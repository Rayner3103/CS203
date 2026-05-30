# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: TARIFF

A full-stack application for managing and calculating import tariffs in the technology sector (semiconductors, laptops, smartphones, SSDs, GPUs). Has two roles — `Admin` (CRUD on tariffs) and `User` (browse/search/calculate/export).

## Architecture

Three independent services orchestrated by Docker Compose at the repo root:

- `backend/` — **Spring Boot 4.0.0-M2 on Java 21**, layered as `controller → service → repository → model` under `com.tariff.backend`. JWT auth lives in `component/JwtAuthFilter.java` + `service/JwtService.java`, wired in `config/SecurityConfig.java` and `config/ApplicationConfig.java`. Tokens are issued as cookies (frontend uses `credentials: "include"`, not `Authorization` headers). Persistence is JPA/Hibernate against Postgres (H2 is used only in tests). The `PredictionService` ingests PDFs via PDFBox and calls Gemini (`com.google.genai`) for tariff-change predictions — this is why backend needs `GEMINI_API_KEY` and a 10 MB multipart limit.
- `frontend/` — **Next.js 15 (App Router) + React 19**, Turbopack-built, Tailwind v4. Pages live under `app/` (`login`, `signup`, `dashboard`, `calculator`, `crud`, `simulation`, `user-management`, `profile`, `data`). All HTTP goes through `utils/apiClient.js` (`apiFetch`) which always sends `credentials: "include"` — do not bypass it, or cookie-based auth breaks. Backend base URL comes from `NEXT_PUBLIC_BACKEND_EC2_HOST` (baked at build time via Docker build-arg).
- `scrapper/` — **FastAPI + cron** Python service. `main.py` exposes `/status`, `/lock`, `/unlock`, `/scrape`; `scrapper.py` / `sequential_scrapper.py` pull WITS tariff data and write to Postgres. In production the container runs `cron -f` and triggers `main.py` nightly; the FastAPI endpoints are for manual runs.

The three services share the Postgres instance defined in `compose.yaml`. `init-db/` SQL runs on first DB boot; `demoData.sql` seeds demo content.

## Common commands

All run from the indicated directory.

**Whole stack (repo root):**
- `docker compose up --build` — dev compose (builds images locally from `compose.yaml`). Needs a `.env` with `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `BACKEND_PORT`, `FRONTEND_PORT`, `JWT_SECRET_KEY`, `JWT_EXP_TIME`, `GEMINI_API_KEY`. The CORS origin, cookie flags, and `NEXT_PUBLIC_API_BASE_URL` are derived in `compose.yaml` for local http.
- `docker compose -f compose-deployment.yaml up` — legacy all-in-one self-host (db+backend+frontend+scrapper), pulls pre-built `raynersim/*:v1.0` images.

**Cloud deployment (Vercel + Render + Neon):** see [DEPLOYMENT.md](DEPLOYMENT.md). Frontend → Vercel, backend → Render (Docker), database → Neon (seed once with `neon-seed.sql`). Scrapper is not deployed (run locally against Neon with `DB_SSLMODE=require`).

**Backend (`backend/`):**
- `./mvnw spring-boot:run` — run locally (expects env vars from `application.properties`; needs a running Postgres).
- `./mvnw test` — full test suite (JUnit 5 + Mockito + `@DataJpaTest` against H2). Generates JaCoCo report at `target/site/jacoco/`.
- `./mvnw test -Dtest=TariffServiceTest` — run one test class. `-Dtest=TariffServiceTest#calculateRate_returnsExpected` for a single method.
- `./mvnw clean package -DskipTests` — build the jar.
- JaCoCo `check` enforces a **30% line coverage minimum per package** and excludes `model/`, `dto/`, `exception/*Exception.class`, `config/`, `controller/`, `repository/`, `BackendApplication`, and `AuthFailureHandler`. New code outside those paths must keep coverage above the threshold.

**Frontend (`frontend/`):**
- `npm run dev` — Next dev server on :3000 (Turbopack).
- `npm run build` / `npm run start` — production build / serve.
- `npm test` — Jest + Testing Library (`jest.config.js`, `jest.setup.js`). `npm test -- components/__tests__/login-form.test.js` for one file; `npm test -- -t "name"` for one test.
- `npm run lint` — ESLint (`eslint.config.mjs`, `eslint-config-next`).

**Scrapper (`scrapper/`):**
- `pip install -r requirements.txt && uvicorn main:app --reload` — run the API locally.
- `python main.py` — run a one-shot scrape (what the container's cron job invokes).

## Things to know before editing

- **Spring Boot is on milestone 4.0.0-M2 + Spring Modulith 2.0.0-M2.** Some APIs differ from 3.x GA; check the actual classpath before relying on Stack Overflow answers for 3.x.
- **Auth is cookie-based, not header-based.** The commented `Authorization` lines in `utils/apiClient.js` are intentional — adding bearer-token logic without also changing the backend filter will silently break login. Because the cloud setup is cross-site (Vercel↔Render), the `auth_token` cookie's `Secure`/`SameSite` are env-driven (`COOKIE_SECURE`, `COOKIE_SAMESITE` in `UserController`) — prod uses `true`/`None`, local http uses `false`/`Lax`.
- **Frontend API base URL** comes from a single env var `NEXT_PUBLIC_API_BASE_URL` (a *full* URL incl. scheme, no port, no trailing slash). It's baked at build time; every `fetch` interpolates it. CORS allow-list on the backend is `app.frontend.origins` (env `FRONTEND_ORIGIN`, comma-separated, pattern-capable for `https://*.vercel.app`).
- **`spring.jpa.hibernate.ddl-auto=update`** means schema changes happen automatically against Postgres in dev. Be deliberate about model changes; there are no migration files.
- **Test pyramid:** services are unit-tested with Mockito, repositories with `@DataJpaTest` + H2, controllers are intentionally not unit-tested (excluded from coverage). When adding a controller, put the logic in a service so it stays testable.
- **CI** (`.github/workflows/backend.yml`, `frontend.yml`, `scrapper.yml`) runs on pushes/PRs that touch the respective directory only — a backend-only change won't trigger frontend CI. Codecov uploads are split by flag (`backend`, `frontend`).
