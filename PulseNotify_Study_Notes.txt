================================================================================
PULSENOTIFY — FLIGHT PRICE MONITOR & ALERT SYSTEM: COMPLETE REFERENCE NOTES
================================================================================
Repository URL: https://github.com/Gaurang-Agl/PulseNotify
Project Type: Real-Time Flight Price Monitoring & Asynchronous Alert Engine
Tech Stack: Python 3.10+, Django, Django REST Framework (DRF), Celery, Celery Beat, Redis, PostgreSQL, React 18, Vite 6, Docker Compose
Target Audience: Google NotebookLM Ingestion, Developers, Students, and Non-Technical Learners

--------------------------------------------------------------------------------
TABLE OF CONTENTS
--------------------------------------------------------------------------------
0. PulseNotify in Plain English (Layman & Executive Perspective)
1. The Real-World Problem & Analogy
2. What is PulseNotify?
3. System Architecture Explained for Laymen
4. The 6 Core Building Blocks
5. Database Models: How Data is Stored
6. Step-by-Step Operational Workflow (Life of an Alert)
7. Complete API Endpoints Reference
8. Setup & Running Guide (Step-by-Step, 5 Terminals)
9. Smart Engineering & Design Decisions (The 4 Pillars)
10. Testing & Quality Assurance
11. Layman's Dictionary of Technical Terms
12. Frequently Asked Questions (NotebookLM Ready)

--------------------------------------------------------------------------------
0. PULSENOTIFY IN PLAIN ENGLISH (LAYMAN & EXECUTIVE PERSPECTIVE)
--------------------------------------------------------------------------------
EXPLAIN LIKE I'M 5 (ELI5):
You want to fly from Delhi to Mumbai, but you only want to pay ₹4,000. Airline tickets fluctuate dozens of times every single day. You cannot sit in front of a computer 24/7 refreshing ticket websites. PulseNotify is your tireless, 24/7 personal travel butler that monitors fares every 30 seconds and notifies you the exact millisecond the price drops.

THE 30-SECOND METAPHOR: "THE PERSONAL FLIGHT BUTLER"
1. You Set a Target: You tell the butler: "Notify me if DEL-BOM drops below ₹4,000." Takes 5 seconds.
2. Auto-Scan (30s): Butler checks the departure board every 30 seconds automatically (or immediately when you tap 'Scan Now').
3. Instant Catch (0ms): The fare drops to ₹3,800. Butler spots it instantly without waiting.
4. Zero Spam Guard: Butler taps your shoulder once with your ₹200 savings, then stays quiet. It won't spam you every 30 seconds while the price stays low.

PLAIN ENGLISH <-> TECHNOLOGY TRANSLATION MATRIX:
- The Autonomous Alarm Clock: Celery Beat (30s Cycle) — Wakes up quietly every 30.0s to initiate flight price checks in the background.
- The Lightning Messenger: Redis 7 Broker & Cache — Holds tasks and saves price snapshots for 30s so the UI and workers always agree.
- The Dedicated Worker: Celery Worker Pool (--pool=solo) — Handles database writes and notification tasks in the background so the web app never freezes.
- The Unbreakable Safe: PostgreSQL 17 Database — Stores accounts, alerts, and audit logs. Deactivating an alert keeps historical logs forever.
- The Fuel Gauge: Quota Milestone Trapping — Warns administrators at 25%, 50%, 60%, 70%, 80%, and 90% usage so API credits never run out unexpectedly.
- The Private Compartment: Row-Level JWT Isolation — Guarantees User A can never see User B's alerts. Guessing another user's alert ID returns a blank 404.
- The Smart Bundler: O(N) -> O(1) Route Batching — If 1,000 travelers monitor DEL-BOM, PulseNotify calls the airline once, not 1,000 times.

--------------------------------------------------------------------------------
1. THE REAL-WORLD PROBLEM & ANALOGY
--------------------------------------------------------------------------------
THE PROBLEM:
You know that feeling when you check a flight price today, it is ₹6,200, you close the tab, and when you come back tomorrow it is ₹9,800? 
That is the problem PulseNotify solves.

Airline ticket prices fluctuate wildly depending on algorithms, demand, and seat availability. Humans cannot sit in front of a computer 24 hours a day, 7 days a week constantly hitting "refresh".

THE REAL-WORLD ANALOGY:
Imagine hiring a personal travel assistant:
1. You say: "I want to fly from Delhi (DEL) to Mumbai (BOM). If the ticket drops below ₹4,500, tap me on my shoulder immediately."
2. Your assistant goes to the airport departure board every 30 seconds (or immediately when you tap 'Scan Now').
3. The board says ₹6,000... your assistant waits.
4. The board drops to ₹4,200... your assistant immediately taps your shoulder and shouts: "Book now! The price just dropped to ₹4,200!"
5. Your assistant notes down: "I already alerted you," so they do not yell at you every 30 seconds.

PulseNotify is that tireless, automated assistant in software form. It is the exact engine behind commercial systems like Google Flights alerts, Skyscanner price notifications, and Hopper's price prediction.

--------------------------------------------------------------------------------
2. WHAT IS PULSENOTIFY?
--------------------------------------------------------------------------------
PulseNotify is a real-time, distributed flight price monitoring backend and single-page dashboard.

KEY CAPABILITIES:
- User Authentication: Secure registration and login using JSON Web Tokens (JWT) and Role-Based Access Control (User vs. Admin).
- Custom Price Thresholds: Users set alert routes (e.g. Origin DEL, Destination BOM, Target Price ₹4,500).
- Dual-Trigger Evaluation Engine: Alerts evaluate instantly (0ms latency) upon price discovery via a synchronous ingestion hook, supplemented by a synchronized 30-second Celery Beat background scheduler.
- Shared Redis Price Snapshot: 30-second Redis price cache (TTL=30s) guarantees identical pricing between frontend Flight Radar and backend workers.
- On-Demand "Scan Now" Force-Refresh: Passing `?refresh=true` invalidates/bypasses the 30s Redis cache on-demand, fetching fresh fluctuating fares immediately.
- Multi-Alert Route Tagging & Tiered Triggering: Multiple alerts on the same route display aggregated badges (e.g., "2 Alerts Active: <=₹4,000, <=₹3,500"). If price drops below both thresholds (e.g. ₹3,200), both trigger independently with separate audit logs.
- Asynchronous Processing: Heavy operations (checking prices, sending notifications) run in background worker queues so web APIs respond in milliseconds.
- Soft Delete & Audit Protection: Users can deactivate alerts without wiping their historical data.
- Admin Intelligence Dashboard: System administrators can see high-level statistics: total alerts, active vs. triggered counts, total notifications sent, top trending routes, and third-party API quota milestone tracking.

--------------------------------------------------------------------------------
3. SYSTEM ARCHITECTURE EXPLAINED FOR LAYMEN
--------------------------------------------------------------------------------
In standard web development, if a user clicks a button and the server spends 30 seconds querying flight prices from external APIs, the browser will freeze, show a loading spinner, or time out.

PulseNotify solves this by decoupling the Front Receptionist from the Factory Workers:

[User / Mobile App / Postman]
       |
       v (HTTP Request: "Alert me when DEL-BOM < ₹4,500")
+------------------------------------+
| Django REST Framework (API Server) | <--- Saves alert into PostgreSQL (takes 5ms)
+------------------------------------+
       |
       +---> [Trigger Path A: 0ms Synchronous Ingestion Hook]
       |     evaluate_alerts_for_price() synchronously checks incoming price feeds
       |
       +---> [Trigger Path B: 30-Second Celery Beat Scheduler]
             Wakes up every 30.0 seconds to check all active routes
       |
       v
+------------------------------------+
| Redis 7 Broker & Price Cache       | <--- Holds job queue & 30s price snapshot
+------------------------------------+
       | (Picks up job immediately)
       v
+------------------------------------+
| Celery Worker (The Factory Worker) | <--- Queries internal price feed / Redis cache
+------------------------------------+
       | (If Current Price <= Threshold)
       v
+------------------------------------+
| NotificationLog Record Created     | <--- Marks alert status to 'triggered'
+------------------------------------+

--------------------------------------------------------------------------------
4. THE 6 CORE BUILDING BLOCKS
--------------------------------------------------------------------------------
1. THE RECEPTIONIST: Django & Django REST Framework (DRF)
   - Handles public and private web requests.
   - Validates user input (e.g. verifying 3-letter uppercase IATA codes, ensuring positive prices).
   - Generates authentication tokens (JWT).

2. THE ALARM CLOCK: Celery Beat
   - A time-based scheduler.
   - Fires every 30 seconds on the dot to dispatch price check tasks across all active routes.

3. THE WAITING ROOM & CACHE: Redis 7
   - Ultra-fast, in-memory data store.
   - Holds tasks in a message queue until background workers are ready to execute them.
   - Serves as a 30-second route price snapshot cache (pulsenotify:flight_price:{ROUTE}), providing a single source of truth.

4. THE FACTORY WORKER: Celery Worker Pool
   - Runs independently in the background (--pool=solo on Windows).
   - Picks up tasks from Redis, evaluates prices against alert thresholds, and records notifications.

5. THE PERMANENT VAULT: PostgreSQL 17
   - The relational database storing all user credentials, profiles, price alerts, historical notification logs, and API quota counters.

6. THE VISUAL COCKPIT: React 18 + Vite 6 Single-Page Application
   - Features real-time Flight Radar with 30s auto-refresh countdown, multi-alert badges, on-demand "Scan Now" button, and admin quota banners.

--------------------------------------------------------------------------------
5. DATABASE MODELS: HOW DATA IS STORED
--------------------------------------------------------------------------------
Defined in `pulse/models.py`:

MODEL 1: UserProfile
- Connected one-to-one with Django's built-in User.
- Fields: user (OneToOne), role ("user" | "admin"), created_at.
- Purpose: Ensures strict Role-Based Access Control (RBAC).

MODEL 2: PriceAlert
- Represents an individual price watch request.
- Fields: user (FK), origin (3-char IATA), destination (3-char IATA), threshold_price, status ("active" | "triggered" | "inactive"), created_at.
- Soft Delete: When deleted, status changes to "inactive" rather than deleting the row.

MODEL 3: NotificationLog
- Represents an alert that has fired.
- Fields: alert (FK), triggered_price, message, notified_at.
- Immutable audit log preserving savings calculations.

MODEL 4: ApiQuota
- Tracks monthly consumption of third-party airline API calls.
- Fields: month_key ("YYYY-MM"), monthly_limit (e.g. 2000), used_calls, alerted_milestones ([25, 50, 60, 70, 80, 90]), updated_at.

MODEL 5: QuotaAlertLog
- Immutable audit trail of quota milestone breaches.
- Fields: milestone (int), consumed_percentage, used_calls, message, created_at.

--------------------------------------------------------------------------------
6. STEP-BY-STEP OPERATIONAL WORKFLOW (LIFE OF AN ALERT)
--------------------------------------------------------------------------------
STEP 1: User Registration
- User sends: POST /api/auth/register/ with username and password.
- Password is encrypted using PBKDF2/SHA-256.
- UserProfile is automatically created with role="user".
- Returns a secure JWT access token.

STEP 2: Creating the Price Alert
- User sends: POST /api/alerts/ with header Authorization: Bearer <token>.
- Body: {"origin": "DEL", "destination": "BOM", "threshold_price": 4500}
- Serializer validates:
  * Origin must be 3 uppercase letters (IATA standard).
  * Destination must be 3 uppercase letters.
  * Origin and Destination cannot be the same.
  * Threshold price must be strictly greater than 0.
- Saved in PostgreSQL with status="active".

STEP 3: Dual-Trigger Monitoring (0ms Instant + 30s Beat)
- Path A: When any user queries GET /api/flights/price/?route=DEL-BOM, the system executes evaluate_alerts_for_price() in 0ms.
- Path B: Celery Beat wakes up every 30 seconds and runs check_prices(), aggregating all active routes and checking Redis price cache.
- On-Demand: Clicking "Scan Now" with ?refresh=true bypasses the Redis cache to calculate fresh fares immediately.

STEP 4: Threshold Matching & Tiered Evaluation
- What happens if a user has two alerts on DEL-BOM (≤₹4,000 and ≤₹3,500) and price drops to ₹3,200?
  * Both thresholds are satisfied (3200 <= 4000 and 3200 <= 3500).
  * The engine iterates over all matching active alerts and calls send_notification.delay() for each.
  * Alert 1 (≤₹4,000) records ₹800 savings; Alert 2 (≤₹3,500) records ₹300 savings.
  * Both alerts transition to 'triggered' atomically.

STEP 5: Notification Logging & Spam Prevention
- send_notification executes in Celery worker.
- Creates NotificationLog records with message and timestamp.
- Updates alert status to "triggered".
- Because the alert is now "triggered", subsequent 30-second cycles do not fire duplicate notifications.

STEP 6: Checking History
- The user can view notifications anytime at GET /api/notifications/.

--------------------------------------------------------------------------------
7. COMPLETE API ENDPOINTS REFERENCE
--------------------------------------------------------------------------------
Base URL: http://localhost:8000

1. POST /api/auth/register/
   - Access: Public
   - Action: Register new user; returns JWT token and role.

2. POST /api/auth/login/
   - Access: Public
   - Action: Log in existing user; returns fresh JWT token.

3. POST /api/alerts/
   - Access: Authenticated (JWT)
   - Action: Create a price alert scoped to logged-in user.

4. GET /api/alerts/
   - Access: Authenticated (JWT)
   - Action: List user's price alerts (supports optional `?status=active|triggered|inactive`).

5. GET /api/alerts/<id>/
   - Access: Authenticated (JWT)
   - Action: View details of a single alert owned by user (unauthorized returns 404).

6. DELETE /api/alerts/<id>/
   - Access: Authenticated (JWT)
   - Action: Soft-deactivates the alert (sets status to "inactive").

7. GET /api/flights/price/?route=DEL-BOM
   - Access: Public
   - Action: Flight pricing feed with 30s Redis cache snapshot & quota telemetry.

8. GET /api/flights/price/?route=DEL-BOM&refresh=true
   - Access: Public
   - Action: On-demand force-refresh: bypasses 30s Redis cache, calculates fresh price.

9. GET /api/notifications/
   - Access: Authenticated (JWT)
   - Action: Returns notification history with calculated savings for the user.

10. GET /api/admin/summary/
    - Access: Admin Only (Role = 'admin')
    - Action: Platform statistics (total alerts, active, triggered, top routes).

11. GET /api/admin/quota/
    - Access: Public / Admin
    - Action: Real-time monthly API quota telemetry and audit logs.

12. POST /api/admin/quota/
    - Access: Public / Admin
    - Action: Resets monthly API quota consumption counter to 0.

13. POST /api/admin/quota/simulate/
    - Access: Public / Admin
    - Action: Deterministic milestone testing (25%, 50%, 60%, 70%, 80%, 90%).

--------------------------------------------------------------------------------
8. SETUP & RUNNING GUIDE (STEP-BY-STEP, 5 TERMINALS)
--------------------------------------------------------------------------------
PREREQUISITES:
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ & npm
- Docker & Docker Compose
- Git

TERMINAL 1 (Docker Infrastructure):
docker compose up -d
(Starts PostgreSQL 17 on 5432 and Redis 7 on 6379)

TERMINAL 2 (Django Server):
.\venv\Scripts\Activate.ps1
python manage.py runserver

TERMINAL 3 (Celery Worker):
.\venv\Scripts\Activate.ps1
celery -A config worker --loglevel=info --pool=solo

TERMINAL 4 (Celery Beat Scheduler):
.\venv\Scripts\Activate.ps1
celery -A config beat --loglevel=info

TERMINAL 5 (Frontend Vite SPA):
cd frontend
npm run dev

--------------------------------------------------------------------------------
9. SMART ENGINEERING & DESIGN DECISIONS (THE 4 PILLARS)
--------------------------------------------------------------------------------
1. Route-Level Batching ($O(N) -> O(1)$):
   If 1,000 users track DEL-BOM, PulseNotify queries the pricing feed ONCE, then verifies all 1,000 users in memory. This eliminates 99.9% of external network load.

2. Idempotent 3-State Machine & Zero Spam:
   Alerts transition ACTIVE -> TRIGGERED -> INACTIVE. A user is never spammed every 30 seconds once their target is reached.

3. Third-Party API Quota Milestone Trapping:
   Tracks monthly consumption against limits (e.g. 2,000 calls) and logs milestone traps at 25%, 50%, 60%, 70%, 80%, and 90%, displaying warning banners on the dashboard before credits run out.

4. Multi-Tenant Scoping & 404 Cloaking:
   Every query filters by `user=request.user`. Attempting to access another user's alert ID returns 404 Not Found rather than 403 Forbidden, preventing ID enumeration.

--------------------------------------------------------------------------------
10. TESTING & QUALITY ASSURANCE
--------------------------------------------------------------------------------
UNIT TESTS:
Run all automated test suites:
python manage.py test

Covers:
- PriceThresholdTest: Ensures notifications trigger only when prices fall below or equal threshold.
- NotificationLogTest: Ensures logs are created with correct price and message format.
- AlertScopingTest: Ensures users can only view and delete their own alerts.
- QuotaTrackerTests: Tests monthly quota tracking and milestone trap logic.

FRONTEND TYPECHECK & BUILD:
cd frontend
npm run typecheck
npm run build

--------------------------------------------------------------------------------
11. LAYMAN'S DICTIONARY OF TECHNICAL TERMS
--------------------------------------------------------------------------------
- API (Application Programming Interface): A digital waiter. You tell the waiter what data you want, the waiter tells the kitchen (server), and brings you the data.
- Backend: Everything that happens behind the curtains on the server (calculations, databases, background tasks).
- Asynchronous: Tasks that happen in the background without making the user wait.
- Celery: A background task manager for Python.
- Celery Beat: An automated timer/alarm clock that triggers tasks every 30 seconds.
- Redis: A super-fast in-memory queue and 30-second price cache.
- PostgreSQL: An enterprise relational database that permanently stores tables of data.
- JWT (JSON Web Token): A secure digital passcard proving you are logged in.
- IATA Code: Standard 3-letter airport identifier (e.g., DEL for Delhi).
- Soft Delete: Marking a record inactive instead of permanently erasing it.

--------------------------------------------------------------------------------
12. FREQUENTLY ASKED QUESTIONS (NOTEBOOKLM READY)
--------------------------------------------------------------------------------
Q1: How does PulseNotify prevent duplicate notifications?
A: When an alert's threshold is met, the system creates a NotificationLog entry and immediately changes the alert's status to 'triggered'. Future periodic price checks only query alerts with status='active'.

Q2: Can one user see another user's flight alerts?
A: No. Every query is filtered by `user=request.user`. Attempting to access or delete another user's alert ID returns a 404 Not Found error.

Q3: Why not just check flight prices when the user opens the app?
A: Airline price drops often last only a few hours. If the user doesn't open the app, they miss the deal. PulseNotify watches prices 24/7 in the background so users never miss a deal.

Q4: What happens if a user has two alerts on DEL-BOM (one for <=₹4,000 and one for <=₹3,500) and the price drops to ₹3,200?
A: Both alerts trigger independently. The evaluation engine identifies all active alerts whose threshold is >= ₹3,200. Because both ₹4,000 and ₹3,500 satisfy the condition, the system enqueues two separate Celery tasks. Each task generates its own NotificationLog entry with individual savings calculations (₹800 savings for the ₹4,000 alert and ₹300 savings for the ₹3,500 alert) and transitions each alert atomically to 'triggered'. Neither alert is re-triggered on future cycles.

Q5: Why specify --pool=solo for Celery workers on Windows?
A: Windows does not support POSIX fork(), which Celery defaults to on Linux. Running without --pool=solo on Windows causes multiprocessing deadlocks and task freezing. The solo pool runs tasks in a single thread, providing complete reliability during local development.

================================================================================
END OF PULSENOTIFY NOTES
================================================================================
