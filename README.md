# PulseNotify — Flight Price Monitor & Alert System
## Real-Time Flight Price Monitoring, Event-Driven Alerting & Telemetry Engine

PulseNotify is a production-grade, distributed flight price monitoring backend and single-page dashboard built with **Django REST Framework (DRF)**, **Celery**, **Celery Beat**, **Redis 7**, **PostgreSQL 17**, and **React 18 + Vite 6**.

It replicates the price-tracking engines behind **Google Flights**, **Skyscanner**, and **Hopper**:
1. **Instant Response**: Users submit threshold price alerts for routes (e.g. `DEL-BOM` under ₹4,500) and receive a sub-second response without blocking on airline networks.
2. **Dual-Trigger Architecture**: Alerts evaluate **instantly (0ms latency)** upon price discovery via a synchronous ingestion hook, supplemented by a synchronized **30-second Celery Beat** periodic background scheduler.
3. **Shared Redis Price Snapshot**: A 30-second Redis price cache (`TTL=30s`) guarantees identical pricing between frontend Flight Radar and backend Celery workers, eliminating race conditions.
4. **On-Demand "Scan Now" Force-Refresh**: Passing `?refresh=true` invalidates/bypasses the 30s Redis cache on-demand, fetching fresh fluctuating fares immediately and evaluating matching alerts.
5. **Multi-Alert Route Tagging & Tiered Triggering**: Multiple travelers (or a single traveler with multiple budget levels) can monitor the same route. If a fare drops below multiple thresholds, each alert triggers independently with separate audit logs and savings calculations.
6. **Asynchronous Dispatch & Anti-Spam Idempotency**: Celery dispatches `send_notification.delay()`, records an immutable audit log, and transitions the alert status from `ACTIVE` to `TRIGGERED` to prevent duplicate alert spam.
7. **Enterprise Security & Quota Telemetry**: Row-level multi-tenant isolation cloaks other users' alerts with HTTP 404, while administrators monitor real-time platform analytics and third-party API quota milestones (25%, 50%, 60%, 70%, 80%, and 90%).

---

## 0. PulseNotify in Plain English (Layman & Executive Perspective)

> **Explain Like I'm 5 (ELI5)**: You want to travel from Delhi to Mumbai, but only if the flight is under ₹4,000. Airline tickets fluctuate dozens of times a day. You cannot sit in front of a computer 24/7 refreshing ticket websites. PulseNotify is your **tireless, 24/7 personal travel butler** that monitors fares every 30 seconds and notifies you the exact millisecond the price drops.

### The 30-Second Metaphor: "The Personal Flight Butler"

| Phase | Butler Action | System Reality |
| :--- | :--- | :--- |
| **1. Set Target** | You tell the butler: *"Notify me if DEL-BOM drops below ₹4,000."* | Creates a row in PostgreSQL with `status="active"`. Takes 5ms. |
| **2. Auto-Scan (30s)** | Butler checks the airport departure screen every 30s (or when you tap 'Scan Now'). | Celery Beat scheduler ticks every 30.0s; on-demand scan bypasses cache with `?refresh=true`. |
| **3. Instant Catch (0ms)** | Fare drops to ₹3,800. Butler spots it instantly without waiting. | Synchronous ingestion hook `evaluate_alerts_for_price()` triggers notifications in 0ms. |
| **4. Zero Spam Guard** | Butler taps your shoulder once with your ₹200 savings, then stays quiet. | State machine flips alert to `TRIGGERED`. No repeated notification spam every 30 seconds. |

### Plain English $\leftrightarrow$ Under-the-Hood Technology Translation Matrix

| Plain English Concept | Engineering Implementation | How It Works in Layman Terms |
| :--- | :--- | :--- |
| **The Autonomous Alarm Clock** | **Celery Beat (30s Cycle)** | Wakes up quietly every 30.0 seconds to run flight scans even if your laptop is closed. |
| **The Lightning Messenger** | **Redis 7 Broker & Cache** | Holds background jobs and stores 30s price snapshots so the UI and background workers always agree. |
| **The Dedicated Worker** | **Celery Worker Pool** (`--pool=solo`) | Handles database writes and notification tasks in the background so the web app never freezes. |
| **The Unbreakable Safe** | **PostgreSQL 17 Database** | Stores accounts, alerts, and audit logs. Deactivating an alert keeps historical logs forever. |
| **The Fuel Gauge** | **Quota Milestone Trapping** | Warns administrators at 25%, 50%, 60%, 70%, 80%, and 90% usage so API credits never run out. |
| **The Private Compartment** | **Row-Level JWT Isolation** | Guarantees User A can never see User B's alerts. Guessing another user's alert ID returns a blank 404. |
| **The Smart Bundler** | **$O(N) \to O(1)$ Route Batching** | If 1,000 travelers monitor DEL-BOM, PulseNotify calls the airline once, not 1,000 times. |

---

## Architecture & Project Structure

```
PulseNotify/
├── docker-compose.yml              # PostgreSQL 17 and Redis 7 services
├── manage.py
├── requirements.txt                # Pinned backend dependencies
├── .env.example                    # Template environment variables
├── .env                            # Local configuration (never committed)
├── .gitignore
├── .md5                            # Cryptographic integrity manifest
├── update_md5.py                   # Automated MD5 & documentation sync engine
├── GOOGLE_NOTEBOOK_GUIDE.md        # Master NotebookLM study guide
├── GOOGLE_NOTEBOOK_GUIDE.txt       # Auto-synced plaintext guide
├── PulseNotify_Study_Notes.md      # Layman & technical reference notes
├── PulseNotify_Study_Notes.txt     # Auto-synced plaintext notes
├── ARCHITECTURE_AND_EXECUTION_GUIDE.md# Complete system manual & verification steps
├── SYSTEM_PRESENTATION_GUIDE.html     # Standalone interactive dark-mode presentation guide
├── PulseNotify.postman_collection.json      # Automated Postman test scenarios
├── PulseNotify.postman_collection_new.json  # Extended Postman test collection
├── config/
│   ├── __init__.py                 # Exposes Celery app
│   ├── celery.py                   # Celery application configuration
│   ├── urls.py                     # Main project URL routing (/api/ mount)
│   ├── wsgi.py
│   ├── asgi.py
│   └── settings/
│       ├── __init__.py
│       ├── base.py                 # Shared settings (Celery, JWT, DRF, Quota)
│       ├── local.py                # Local development settings
│       └── production.py           # Production settings
├── pulse/
│   ├── models.py                   # UserProfile, PriceAlert, NotificationLog, ApiQuota, QuotaAlertLog
│   ├── serializers.py              # DRF ModelSerializers with validation
│   ├── views.py                    # REST API endpoints & telemetry handlers
│   ├── urls.py                     # App routing
│   ├── permissions.py              # Custom IsAdminUser permission
│   ├── signals.py                  # Auto-creates UserProfile on User creation
│   ├── tasks.py                    # check_prices, evaluate_alerts_for_price, send_notification
│   ├── admin.py                    # Django admin model registration
│   ├── services/
│   │   ├── flight_provider.py      # Pluggable provider engine (Amadeus / Kiwi / Simulator / Redis cache)
│   │   └── quota_tracker.py        # Monthly quota tracker & milestone alerts (25%, 50%, 60%, 70%, 80%, 90%)
│   ├── tests.py                    # Core business logic test suites
│   └── tests_quota.py              # Quota tracker & milestone alert test suites
└── frontend/                       # Modern React 18 + Vite 6 Single-Page Application
    ├── package.json                # React, TypeScript, Tailwind CSS, Lucide, Axios
    ├── vite.config.ts              # Vite dev server with /api reverse proxy
    ├── src/
    │   ├── api/                    # Typed API clients (alerts, auth, flights, quota, admin)
    │   ├── components/             # Reusable UI widgets, layout (Navbar with Beat 30s badge), modal, banner
    │   ├── context/                # AuthContext (JWT rehydration, RBAC) & ToastContext
    │   ├── pages/                  # FlightRadarView, AlertsManagerView, NotificationsView, AdminAnalyticsView, SimulatorView, SystemGuideView
    │   ├── types/                  # TypeScript interfaces matching backend models
    │   └── utils/                  # Formatters, route helpers, and badge helpers
    └── scripts/
        └── test-api-live.js        # Automated live API integration test suite
```

---

## Dual-Trigger Evaluation & Price Cache Architecture

PulseNotify utilizes a synchronized **dual-trigger topology** paired with a shared Redis price cache:

```
[UI / User Request] ──> GET /api/flights/price/?route=DEL-BOM (&refresh=true)
                              │
                              ├── 1. Read or Invalidate Redis Cache (TTL=30s)
                              │
                              └── 2. Trigger Path A: Instant Ingestion Hook (0ms)
                                     evaluate_alerts_for_price()
                                     └── Threshold satisfied? ──> send_notification.delay()

[Celery Beat Scheduler] ──(Every 30.0s)──> Trigger Path B: Periodic Fallback
                                          pulse.tasks.check_prices
                                          └── Evaluates all active routes via Redis snapshot
                                              └── Threshold satisfied? ──> send_notification.delay()
```

1. **Trigger Path A: Instant Event-Driven Ingestion Hook (0ms Latency)**
   - Whenever any traveler, admin, or UI client calls `GET /api/flights/price/?route={ROUTE}`, `evaluate_alerts_for_price()` executes synchronously on the discovered fare.
   - Matching active alerts are identified immediately and dispatched to Celery via `send_notification.delay()`. The HTTP response returns `triggered_alerts` in 0 milliseconds.
2. **Trigger Path B: Celery Beat 30-Second Periodic Fallback**
   - Configured in `CELERY_BEAT_SCHEDULE` with an interval of `30.0` seconds (`check-flight-prices-every-30-seconds`).
   - Ensures continuous background evaluation even when no users are browsing the site.
3. **Redis 7 Shared Route Snapshot Cache (`TTL=30s`)**
   - Route prices are cached under key `pulsenotify:flight_price:{ROUTE}` with a 30-second TTL.
   - Guarantees that the frontend Flight Radar and Celery worker evaluate identical prices, preventing race conditions.
4. **On-Demand "Scan Now" Force-Refresh (`force_refresh=True` / `?refresh=true`)**
   - Clicking "Scan Now" or hitting the 30-second countdown in Flight Radar invokes `GET /api/flights/price/?route=...&refresh=true`.
   - `CachedFlightProvider` invalidates/bypasses the Redis cache, calculates a fresh fluctuating fare, overwrites the cache with a fresh 30s TTL, and triggers instant alert cross-checking.

---

## Multi-Alert Route Tagging & Tiered Triggering Logic

### 1. Multi-Alert Route Tagging on Flight Radar
When multiple alerts exist on the same route (e.g., Alert #1 with threshold ₹4,000 and Alert #2 with threshold ₹3,500 on `DEL → BOM`), Flight Radar renders:
- Badge counter: `🔔 2 Alerts Active` (or `⚡ 2 Triggered!`).
- Individual threshold chips: `≤₹4,000` and `≤₹3,500`.

### 2. Tiered Triggering Mechanics: What Happens When Price Drops?
Suppose a user has two alerts on `DEL-BOM`:
- **Alert A**: Target $\le ₹4,000$ (Conservative budget)
- **Alert B**: Target $\le ₹3,500$ (Aggressive deal)

**Scenario 1: Price drops to ₹3,800**
- Condition for Alert A ($3,800 \le 4,000$): **MET**. Alert A triggers, records notification with ₹200 savings, status becomes `TRIGGERED`.
- Condition for Alert B ($3,800 \le 3,500$): **NOT MET**. Alert B remains `ACTIVE`.

**Scenario 2: Price drops to ₹3,200**
- Condition for Alert A ($3,200 \le 4,000$): **MET**. Alert A triggers, logs ₹800 savings, flips to `TRIGGERED`.
- Condition for Alert B ($3,200 \le 3,500$): **MET**. Alert B triggers, logs ₹300 savings, flips to `TRIGGERED`.
- **System Behavior**:
  - `evaluate_alerts_for_price()` iterates through **all** matching active alerts for the route.
  - Both alerts enqueue separate `send_notification.delay(alert_id, price)` Celery tasks.
  - The Celery worker processes both tasks independently, inserting distinct `NotificationLog` audit records with individual savings calculations.
  - Both alerts transition atomically from `ACTIVE` to `TRIGGERED`. On subsequent 30s scans, neither alert is re-triggered (anti-spam idempotency).

---

## Getting Started

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ & npm
- Docker & Docker Compose
- Git

### 2. Backend Environment & Dependencies
```bash
# Create and activate virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install pinned dependencies
pip install -r requirements.txt
```

### 3. Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 4. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update values as needed (database credentials, secret key, provider API keys).

### 5. Start Infrastructure (PostgreSQL 17 & Redis 7)
```bash
docker compose up -d
```

### 6. Apply Database Migrations
```bash
python manage.py migrate
```

### 7. Run Unit Tests, Typecheck & Integrity Manifest
```bash
# Run backend Django test suites (14 tests)
python manage.py test

# Run frontend TypeScript typecheck & production build
cd frontend
npm run typecheck
npm run build
cd ..

# Verify file integrity manifest
python update_md5.py --check
```

---

## Running PulseNotify (5 Simultaneous Terminals)

PulseNotify operates with 5 concurrent processes:

### Terminal 1: Infrastructure (Docker)
```bash
docker compose up -d
```
Starts PostgreSQL 17 on port 5432 and Redis 7 on port 6379.

### Terminal 2: Django API Server
```bash
python manage.py runserver
```
Runs at `http://localhost:8000`.

### Terminal 3: Celery Worker
```bash
# On Windows (use --pool=solo to avoid Windows fork limitations):
celery -A config worker --loglevel=info --pool=solo

# On Linux / macOS:
celery -A config worker --loglevel=info
```
Monitors Redis for background tasks like `send_notification`.

### Terminal 4: Celery Beat Scheduler (30s Cycle)
```bash
celery -A config beat --loglevel=info
```
Automatically triggers `check_prices` every 30 seconds (supplementing the 0ms instant ingestion evaluator).

### Terminal 5: Frontend Development Server
```bash
cd frontend
npm run dev
```
Runs at `http://localhost:5173` with reverse proxying of `/api` to `http://127.0.0.1:8000`.

---

## API Endpoints Summary

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/` | Public | Register traveler, returns 7-day JWT + auto-provisions profile |
| `POST` | `/api/auth/login/` | Public | Authenticates credentials, returns 7-day JWT |
| `POST` | `/api/alerts/` | JWT (User) | Creates flight price alert scoped to logged-in user (`status='active'`) |
| `GET` | `/api/alerts/` | JWT (User) | Lists user's alerts (supports optional `?status=active\|triggered\|inactive`) |
| `GET` | `/api/alerts/<id>/` | JWT (User) | Retrieves details of user's alert (unauthorized ID returns 404) |
| `DELETE` | `/api/alerts/<id>/` | JWT (User) | Soft-deactivates alert (`status='inactive'`), preserves audit trail |
| `GET` | `/api/flights/price/?route=DEL-BOM` | Public | Fetches route price with 30s Redis cache snapshot & quota telemetry |
| `GET` | `/api/flights/price/?route=DEL-BOM&refresh=true` | Public | **On-demand force-refresh**: bypasses 30s Redis cache, calculates fresh fare |
| `GET` | `/api/notifications/` | JWT (User) | Lists price drop notification history with savings calculations |
| `GET` | `/api/admin/summary/` | Admin Only | Platform-wide metrics, active vs. triggered ratios & top routes |
| `GET` | `/api/admin/quota/` | Public/Admin | Real-time monthly API quota telemetry and audit logs |
| `POST` | `/api/admin/quota/` | Public/Admin | Resets monthly API quota consumption counter to 0 |
| `POST` | `/api/admin/quota/simulate/` | Public/Admin | Deterministic milestone testing (25%, 50%, 60%, 70%, 80%, 90%) |

---

## Decoupled Module Verification Manual (10 Pointwise Modules)

1. **Module 1: Flight Pricing & 30s Redis Cache**: `GET /api/flights/price/?route=DEL-BOM` serves fares cached in Redis key `pulsenotify:flight_price:DEL-BOM` for 30s. Adding `&refresh=true` forces an immediate fresh fare.
2. **Module 2: SimpleJWT Authentication & Auto-Profile Hook**: `POST /api/auth/register/` issues 7-day JWT tokens and auto-provisions a `UserProfile` (`role='user'`) via Django signals.
3. **Module 3: Price Alert Lifecycle & Idempotency Engine**: `POST /api/alerts/` validates uppercase 3-letter IATA codes, positive thresholds, and sets `status='active'`.
4. **Module 4: Instantaneous Ingestion & Cross-Checking Engine (0ms)**: Synchronous hook `evaluate_alerts_for_price()` executes on fare discovery; triggers matching alerts with 0ms delay.
5. **Module 5: Celery Beat 30-Second Background Scheduler**: Ticks every 30.0s (`check-flight-prices-every-30-seconds`) into Redis broker to evaluate routes autonomously.
6. **Module 6: Celery Worker Async Execution & Solo Pool**: Worker runs with `--pool=solo` on Windows; dequeues `send_notification` and updates database asynchronously.
7. **Module 7: Notification Center & Savings Audit Trail**: `GET /api/notifications/` returns immutable audit records including origin, destination, triggered price, and savings.
8. **Module 8: Soft Delete & State Machine Protection**: `DELETE /api/alerts/<id>/` sets `status='inactive'`, preserving foreign keys for notification audit logs.
9. **Module 9: Multi-Tenant Isolation & 404 Cloaking**: Querysets scoped by `user=request.user`. Attempting to access another user's alert ID returns HTTP 404 (cloaking existence) instead of 403.
10. **Module 10: Admin RBAC Telemetry & Quota Milestone Trapping**: Non-admin calling `/api/admin/summary/` returns 403. Quota milestones (25%, 50%, 60%, 70%, 80%, 90%) trigger warning banners and audit logs.

---

## The 4 Core Engineering Architecture Pillars

1. **$O(N) \to O(1)$ Route Aggregation**: PulseNotify executes `active_alerts.values_list('origin', 'destination').distinct()`. Querying 1,000 alerts on `DEL-BOM` makes **1 airline API call**, evaluating all 1,000 thresholds in memory.
2. **Idempotent 3-State Machine**: Alerts follow `ACTIVE` $\to$ `TRIGGERED` $\to$ `INACTIVE`. When a threshold is met, the alert transitions to `TRIGGERED` upon notification dispatch, preventing duplicate spam on subsequent 30s ticks.
3. **Third-Party API Quota Milestone Trapping**: Tracks monthly API consumption against limits (e.g. Amadeus 2,000 free calls) and logs milestone traps at 25%, 50%, 60%, 70%, 80%, and 90%, rendering proactive warnings on the UI.
4. **Multi-Tenant Data Isolation & 404 Cloaking**: Row-level filtering at the ORM layer. Requesting another user's alert ID returns 404 Not Found rather than 403 Forbidden, preventing Insecure Direct Object Reference (IDOR) enumeration.

---

## Django Admin Portal
System administrators can log in to the Django admin panel at `http://127.0.0.1:8000/admin/` to inspect real-time database state (Users, Profiles, PriceAlerts, NotificationLogs, ApiQuotas, QuotaAlertLogs):

<img width="1217" height="809" alt="image" src="https://github.com/user-attachments/assets/7befa5c1-e8be-4210-ac30-d448f7f3392a" />

<img width="1257" height="808" alt="image" src="https://github.com/user-attachments/assets/f18b1e35-0867-42c9-b6c8-bb9372b92d75" />

<img width="1246" height="666" alt="image" src="https://github.com/user-attachments/assets/199a6251-00f3-4759-9904-46ebe7594f05" />
