# PulseNotify — Flight Price Monitor & Alert System

PulseNotify is a real-time flight price monitoring backend built with **Django REST Framework**, **Celery**, **Celery Beat**, **Redis**, and **PostgreSQL**.

It replicates the price-tracking engines behind Google Flights and Skyscanner:
1. **Instant Response**: Users submit threshold price alerts for routes (e.g. `DEL-BOM` under ₹4,500) and receive an instant response.
2. **Automated Polling**: Celery Beat wakes up every 60 seconds without manual interaction.
3. **Internal Price Feed**: A mock endpoint (`/api/flights/price/`) simulates live price fluctuations.
4. **Asynchronous Dispatch**: When a flight drops below the threshold, Celery fires `send_notification.delay()` to record a notification log and mark the alert triggered.
5. **Admin Analytics & Security**: Only administrators can view platform statistics; users only ever see their own alerts.

---

## Architecture & Project Structure

```
PulseNotify/
├── docker-compose.yml              # PostgreSQL and Redis services
├── manage.py
├── requirements.txt                # Pinned dependencies
├── .env.example                    # Template environment variables
├── .env                            # Local configuration (never committed)
├── .gitignore
├── PulseNotify.postman_collection.json  # Automated Postman test scenarios
├── config/
│   ├── __init__.py                 # Exposes Celery app
│   ├── celery.py                   # Celery application configuration
│   ├── urls.py                     # Main project URL routing
│   ├── wsgi.py
│   ├── asgi.py
│   └── settings/
│       ├── __init__.py
│       ├── base.py                 # Shared settings (Celery, JWT, DRF)
│       ├── local.py                # Local development settings
│       └── production.py           # Production settings
└── pulse/
    ├── models.py                   # UserProfile, PriceAlert, NotificationLog
    ├── serializers.py              # DRF ModelSerializers with validation
    ├── views.py                    # API endpoints
    ├── urls.py                     # App routing
    ├── permissions.py              # Custom IsAdminUser permission
    ├── signals.py                  # Auto-creates UserProfile on User creation
    ├── tasks.py                    # check_prices & send_notification Celery tasks
    ├── admin.py                    # Django admin model registration
    └── tests.py                    # Business logic test suites
```

---

## Getting Started

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Docker & Docker Compose
- Git

### 2. Virtual Environment & Dependencies
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

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update the values as needed (database credentials, secret key, etc.).

### 4. Start Infrastructure (PostgreSQL & Redis)
```bash
docker compose up -d
```

### 5. Apply Database Migrations
```bash
python manage.py migrate
```

### 6. Run Unit Tests
```bash
python manage.py test
```
All tests across the test suites (`PriceThresholdTest`, `NotificationLogTest`, `AlertScopingTest`) will run and pass cleanly.

---

## Running PulseNotify (3 Simultaneous Terminals)

PulseNotify requires three concurrent processes to operate:

### Terminal 1: Django API Server
```bash
python manage.py runserver
```
Runs at `http://localhost:8000`.

### Terminal 2: Celery Worker
```bash
# On Windows (use --pool=solo to avoid Windows fork limitations):
celery -A config worker --loglevel=info --pool=solo

# On Linux / macOS:
celery -A config worker --loglevel=info
```
Monitors Redis for background tasks like `send_notification`.

### Terminal 3: Celery Beat Scheduler
```bash
celery -A config beat --loglevel=info
```
Automatically triggers `check_prices` every 60 seconds.

---

## API Endpoints Summary

| Method   | Endpoint                            | Access     | Description                                           |
|----------|-------------------------------------|------------|-------------------------------------------------------|
| `POST`   | `/api/auth/register/`               | Public     | Register user, returns JWT + role                     |
| `POST`   | `/api/auth/login/`                  | Public     | Authenticates user, returns fresh JWT                 |
| `POST`   | `/api/alerts/`                      | JWT (User) | Creates price alert scoped to logged-in user          |
| `GET`    | `/api/alerts/`                      | JWT (User) | Lists user's alerts (supports optional `?status=` filter) |
| `GET`    | `/api/alerts/<id>/`                 | JWT (User) | Retrieves details of a specific alert owned by user   |
| `DELETE` | `/api/alerts/<id>/`                 | JWT (User) | Deactivates alert (`status: 'inactive'`)              |
| `GET`    | `/api/flights/price/?route=DEL-BOM` | Public     | Internal mock flight price feed                       |
| `GET`    | `/api/admin/summary/`               | Admin Only | Platform-wide metrics & top routes                    |
| `GET`    | `/api/notifications/`               | JWT (User) | Lists notification history for logged-in user         |

---

## Testing with Postman
Import `PulseNotify.postman_collection.json` into Postman. Set the `base_url` variable to `http://localhost:8000`. The collection contains pre-configured scenarios with automated test scripts that verify status codes and responses.

### Promoting an Admin User for Testing
As required by security specifications, public registration strictly defaults all users to `role: 'user'`. To test the `GET /api/admin/summary/` endpoint with an admin account:
1. Register `admin_user` via Postman (Request in `02 Admin User Authentication`).
2. Promote the user using either of these quick methods:
   - **Terminal (1-line command)**:
     ```bash
     python manage.py shell -c "from django.contrib.auth.models import User; u = User.objects.get(username='admin_user'); u.profile.role='admin'; u.profile.save()"
     ```
   - **Django Admin UI**: Open `http://localhost:8000/admin/pulse/userprofile/` and change the role to `Admin`.
   - **PGAdmin**: Set `role = 'admin'` in the `pulse_userprofile` table.
3. Run `Login Admin User` in Postman to receive an admin token and access `/api/admin/summary/`.

---

## Key Design Decisions

- **Soft Delete for Alerts**: `DELETE /api/alerts/<id>/` sets `status = 'inactive'` rather than removing the database row, preserving audit trails and preventing unnecessary database deletion.
- **Duplicate Notification Prevention**: `send_notification` updates the alert status to `TRIGGERED` upon recording the log, ensuring subsequent Beat ticks do not fire duplicate notifications for the same alert.
- **Role-Based Access Control**: Custom `IsAdminUser` permission checks `UserProfile.role == UserProfile.Role.ADMIN` and safely handles superusers.
- **Strict Input Validation**: Airport codes are validated as 3-letter uppercase IATA codes, origin and destination cannot be identical, and threshold prices must be strictly greater than zero.

----------------------------
Additional url to view at Ui level inside broser is http://127.0.0.1:8000/admin/
where super-user which was created, can perform login and observe realtime changes(Users, Alerts, Notifications etc).
