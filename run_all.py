import os
import sys
import re
import time
import signal
import subprocess
import threading
import webbrowser
from pathlib import Path

# Enable ANSI escape sequences on Windows console
os.system('')

# ANSI Formatting
RESET      = "\033[0m"
BOLD       = "\033[1m"
DIM        = "\033[2m"
ITALIC     = "\033[3m"

# Standard & 256 Colors
FG_RED     = "\033[91m"
FG_GREEN   = "\033[92m"
FG_YELLOW  = "\033[93m"
FG_BLUE    = "\033[94m"
FG_MAGENTA = "\033[95m"
FG_CYAN    = "\033[96m"
FG_WHITE   = "\033[97m"

FG_ORANGE  = "\033[38;5;208m"
FG_PURPLE  = "\033[38;5;141m"
FG_LIME    = "\033[38;5;118m"
FG_TEAL    = "\033[38;5;44m"
FG_AMBER   = "\033[38;5;214m"
FG_PINK    = "\033[38;5;213m"

API_COLORS = {
    "RADAR":  {"color": FG_CYAN,   "tag": "[API:RADAR ]", "desc": "Flight Price Radar"},
    "ALERTS": {"color": FG_AMBER,  "tag": "[API:ALERTS]", "desc": "Price Alert Manager"},
    "NOTIFS": {"color": FG_PURPLE, "tag": "[API:NOTIFS]", "desc": "Notification Center"},
    "AUTH":   {"color": FG_BLUE,   "tag": "[API:AUTH  ]", "desc": "User Authentication"},
    "QUOTA":  {"color": FG_ORANGE, "tag": "[API:QUOTA ]", "desc": "API Quota Telemetry"},
    "ADMIN":  {"color": FG_PINK,   "tag": "[API:ADMIN ]", "desc": "Admin Analytics"},
    "DJANGO": {"color": FG_WHITE,  "tag": "[API:DJANGO]", "desc": "Django Admin/Static"},
    "OTHER":  {"color": FG_TEAL,   "tag": "[API:SERVER]", "desc": "General API"},
}

METHOD_COLORS = {
    "GET":    f"{BOLD}\033[96mGET   {RESET}",
    "POST":   f"{BOLD}\033[92mPOST  {RESET}",
    "PUT":    f"{BOLD}\033[93mPUT   {RESET}",
    "PATCH":  f"{BOLD}\033[93mPATCH {RESET}",
    "DELETE": f"{BOLD}\033[91mDELETE{RESET}",
}

STATUS_COLORS = {
    "200": f"{BOLD}{FG_LIME}200 OK{RESET}",
    "201": f"{BOLD}{FG_LIME}201 CREATED{RESET}",
    "204": f"{BOLD}{FG_LIME}204 NO CONTENT{RESET}",
    "301": f"{BOLD}{FG_BLUE}301 MOVED{RESET}",
    "302": f"{BOLD}{FG_BLUE}302 FOUND{RESET}",
    "304": f"{BOLD}{FG_BLUE}304 NOT MODIFIED{RESET}",
    "400": f"{BOLD}{FG_ORANGE}400 BAD REQUEST{RESET}",
    "401": f"{BOLD}{FG_ORANGE}401 UNAUTHORIZED{RESET}",
    "403": f"{BOLD}{FG_ORANGE}403 FORBIDDEN{RESET}",
    "404": f"{BOLD}{FG_ORANGE}404 NOT FOUND{RESET}",
    "500": f"{BOLD}{FG_RED}500 SERVER ERROR{RESET}",
}

DJANGO_REQ_REGEX = re.compile(
    r'(?:\[(?P<timestamp>[^\]]+)\]\s+)?'
    r'"(?P<method>GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+'
    r'(?P<path>[^\s]+)\s+HTTP/[0-9.]+"\s+'
    r'(?P<status>\d{3})\s+'
    r'(?P<size>\d+)?'
)

PROJECT_ROOT = Path(__file__).resolve().parent
VENV_PYTHON = PROJECT_ROOT / "venv" / "Scripts" / "python.exe"
VENV_CELERY = PROJECT_ROOT / "venv" / "Scripts" / "celery.exe"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

processes = []
is_shutting_down = False

def classify_endpoint(path: str):
    if "/api/flights/price" in path:
        return API_COLORS["RADAR"]
    elif "/api/alerts" in path:
        return API_COLORS["ALERTS"]
    elif "/api/notifications" in path:
        return API_COLORS["NOTIFS"]
    elif "/api/auth" in path:
        return API_COLORS["AUTH"]
    elif "/api/admin/clear-data" in path:
        return {"color": FG_RED, "tag": "[API:CLEAR ]", "desc": "Wipe Platform Data"}
    elif "/api/admin/quota" in path:
        return API_COLORS["QUOTA"]
    elif "/api/admin" in path:
        return API_COLORS["ADMIN"]
    elif path.startswith("/admin") or path.startswith("/static"):
        return API_COLORS["DJANGO"]
    else:
        return API_COLORS["OTHER"]

def format_backend_line(line: str) -> str:
    m = DJANGO_REQ_REGEX.search(line)
    if m:
        method = m.group("method")
        path = m.group("path")
        status = m.group("status")
        size = m.group("size") or ""
        
        cfg = classify_endpoint(path)
        tag = f"{BOLD}{cfg['color']}{cfg['tag']}{RESET}"
        method_str = METHOD_COLORS.get(method, f"{BOLD}{method:<6}{RESET}")
        status_str = STATUS_COLORS.get(status, f"{BOLD}{status}{RESET}")
        size_str = f"{DIM}({size}b){RESET}" if size else ""
        path_str = f"{cfg['color']}{path:<40}{RESET}"
        
        return f"{tag} {method_str} {path_str} {status_str} {size_str}"
    
    # Standard startup and diagnostic messages
    if "Starting development server at" in line:
        return f"{BOLD}{FG_GREEN}[BACKEND   ]{RESET} {FG_LIME}★ Django API Server live at http://127.0.0.1:8000/{RESET}"
    if "Quit the server with" in line or "Watching for file changes" in line:
        return ""
    if "System check identified no issues" in line:
        return f"{BOLD}{FG_GREEN}[BACKEND   ]{RESET} {FG_GREEN}✓ System check passed (0 issues identified){RESET}"
    
    return f"{BOLD}{FG_GREEN}[BACKEND   ]{RESET} {FG_GREEN}{line}{RESET}"

def format_worker_line(line: str) -> str:
    # 1. Send notification task received
    if "pulse.tasks.send_notification" in line and "received" in line:
        return f"{BOLD}{FG_AMBER}[WORKER:ALERT]{RESET} {FG_AMBER}⚡ DISPATCH RECEIVED: Alert threshold satisfied! Generating notification...{RESET}"
    
    # 2. Send notification task succeeded
    if "pulse.tasks.send_notification" in line and "succeeded in" in line:
        m = re.search(r'succeeded in ([\d\.]+s)', line)
        duration = m.group(1) if m else "done"
        return f"{BOLD}{FG_LIME}[WORKER:ALERT]{RESET} {FG_LIME}✓ NOTIFICATION DISPATCHED & LOGGED: Audit record created ({duration}){RESET}"
    
    # 3. Check prices task received
    if "pulse.tasks.check_prices" in line and "received" in line:
        return f"{BOLD}{FG_PURPLE}[WORKER:CRON ]{RESET} {FG_PURPLE}⚙ SCHEDULED ROUTE CHECK: Inspecting distinct routes from Redis snapshot...{RESET}"
    
    # 4. Check prices task succeeded
    if "pulse.tasks.check_prices" in line and "succeeded in" in line:
        m = re.search(r'succeeded in ([\d\.]+s)', line)
        duration = m.group(1) if m else "done"
        return f"{BOLD}{FG_CYAN}[WORKER:CRON ]{RESET} {FG_CYAN}✓ ROUTE CHECK COMPLETED: All active alert thresholds verified ({duration}){RESET}"
    
    # 5. Generic task events
    if "Task " in line and "received" in line:
        m = re.search(r'Task ([\w\.]+)(?:\[[^\]]+\])? received', line)
        task_name = m.group(1) if m else "task"
        return f"{BOLD}{FG_TEAL}[WORKER      ]{RESET} {FG_TEAL}→ RECEIVED task: {BOLD}{task_name}{RESET}"
    
    if "Task " in line and "succeeded in" in line:
        m = re.search(r'Task ([\w\.]+)(?:\[[^\]]+\])? succeeded in ([\d\.]+s)', line)
        if m:
            return f"{BOLD}{FG_LIME}[WORKER      ]{RESET} {FG_LIME}✓ SUCCEEDED: {BOLD}{m.group(1)}{RESET} {FG_LIME}(in {m.group(2)}){RESET}"
    
    if "ready." in line or "ready" in line:
        return f"{BOLD}{FG_LIME}[WORKER      ]{RESET} {FG_LIME}★ Celery worker pool initialized (--pool=solo) & ready{RESET}"
    
    # Warnings and errors
    if "WARNING" in line:
        return f"{BOLD}{FG_ORANGE}[WORKER:WARN ]{RESET} {FG_ORANGE}⚠ {line}{RESET}"
    if "ERROR" in line:
        return f"{BOLD}{FG_RED}[WORKER:ERROR]{RESET} {FG_RED}✗ {line}{RESET}"
        
    return f"{BOLD}{FG_YELLOW}[WORKER      ]{RESET} {DIM}{line}{RESET}"

def format_beat_line(line: str) -> str:
    if "Scheduler: Sending due task" in line:
        if "check-flight-prices" in line:
            return f"{BOLD}{FG_PINK}[BEAT:TICK   ]{RESET} {FG_PINK}⏰ 30s Periodic Schedule: Enqueued check_prices task to Redis{RESET}"
        return f"{BOLD}{FG_PINK}[BEAT:TICK   ]{RESET} {FG_PINK}⏰ Sent scheduled task: {line}{RESET}"
    if "beat: Starting..." in line:
        return f"{BOLD}{FG_MAGENTA}[BEAT        ]{RESET} {FG_MAGENTA}★ Celery Beat scheduler active (30s polling cycle){RESET}"
    return f"{BOLD}{FG_MAGENTA}[BEAT        ]{RESET} {DIM}{line}{RESET}"

def format_frontend_line(line: str) -> str:
    if "VITE" in line and "ready in" in line:
        return f"{BOLD}{FG_TEAL}[FRONTEND   ]{RESET} {BOLD}{FG_LIME}★ {line.strip()}{RESET}"
    if "Local:" in line:
        return f"{BOLD}{FG_TEAL}[FRONTEND   ]{RESET} {BOLD}{FG_CYAN}➜ Local UI: http://localhost:5173/{RESET}"
    if "page reload" in line or "hmr update" in line:
        return f"{BOLD}{FG_TEAL}[FRONTEND:HMR]{RESET} {FG_TEAL}{line.strip()}{RESET}"
    return f"{BOLD}{FG_TEAL}[FRONTEND   ]{RESET} {line}"

def stream_reader(tag: str, pipe):
    """Continuously read lines from a subprocess pipe and print with colored tag."""
    try:
        for line in iter(pipe.readline, ''):
            if is_shutting_down:
                break
            clean_line = line.rstrip('\r\n')
            if not clean_line:
                continue

            formatted = None
            if tag == "BACKEND":
                formatted = format_backend_line(clean_line)
            elif tag == "WORKER":
                formatted = format_worker_line(clean_line)
            elif tag == "BEAT":
                formatted = format_beat_line(clean_line)
            elif tag == "FRONTEND":
                formatted = format_frontend_line(clean_line)
            else:
                formatted = f"{BOLD}[{tag:<12}]{RESET} {clean_line}"

            if formatted:
                print(formatted, flush=True)
    except Exception:
        pass
    finally:
        pipe.close()

def log(tag: str, message: str, color=FG_CYAN):
    prefix = f"{BOLD}{color}[{tag:<12}]{RESET} "
    print(f"{prefix}{message}", flush=True)

def start_docker():
    """Ensure Docker Desktop is running and start postgres/redis containers."""
    log("DOCKER", "Checking Docker status...", FG_BLUE)
    
    check_docker = subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if check_docker.returncode != 0:
        log("DOCKER", "Docker daemon is not responding. Checking Docker Desktop...", FG_ORANGE)
        docker_desktop_paths = [
            Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "DockerDesktop" / "Docker Desktop.exe",
            Path("C:/Program Files/Docker/Docker/Docker Desktop.exe")
        ]
        launched = False
        for p in docker_desktop_paths:
            if p.exists():
                log("DOCKER", f"Starting Docker Desktop from {p}...", FG_BLUE)
                subprocess.Popen([str(p)])
                launched = True
                break
        
        if launched:
            log("DOCKER", "Waiting for Docker daemon to become ready...", FG_BLUE)
            for _ in range(45):
                time.sleep(1)
                if subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                    log("DOCKER", "Docker daemon is ready!", FG_LIME)
                    break
        else:
            log("DOCKER", "WARNING: Could not auto-start Docker Desktop. Please start it manually if needed.", FG_ORANGE)

    log("DOCKER", "Bringing up PostgreSQL and Redis (docker compose up -d)...", FG_BLUE)
    res = subprocess.run(["docker", "compose", "up", "-d"], cwd=str(PROJECT_ROOT), capture_output=True, text=True)
    if res.returncode == 0:
        log("DOCKER", "PostgreSQL 17 & Redis 7 are up and running.", FG_LIME)
    else:
        log("DOCKER", f"docker compose notice: {res.stderr.strip() or res.stdout.strip()}", FG_ORANGE)

def shutdown():
    global is_shutting_down
    if is_shutting_down:
        return
    is_shutting_down = True
    print("\n")
    log("SYSTEM", "Received stop signal. Terminating all processes cleanly...", FG_ORANGE)

    for tag, proc in processes:
        if proc.poll() is None:
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
    log("SYSTEM", "All processes stopped. PulseNotify is offline.", FG_RED)

def main():
    print(f"\n{BOLD}{FG_CYAN}========================================================================{RESET}")
    print(f"{BOLD}{FG_CYAN}       PulseNotify — Unified Full-Stack Terminal Manager                {RESET}")
    print(f"{BOLD}{FG_CYAN}========================================================================{RESET}\n")

    # Legend
    print(f"{BOLD}Live API & Worker Color Legend:{RESET}")
    print(f"  {BOLD}{FG_CYAN}[API:RADAR ]{RESET} {FG_CYAN}Flight Radar 30s Polling & Instant Ingestion{RESET}")
    print(f"  {BOLD}{FG_AMBER}[API:ALERTS]{RESET} {FG_AMBER}Price Alert Management (Create, List, Delete){RESET}")
    print(f"  {BOLD}{FG_PURPLE}[API:NOTIFS]{RESET} {FG_PURPLE}Notification Audit Trail & Savings History{RESET}")
    print(f"  {BOLD}{FG_BLUE}[API:AUTH  ]{RESET} {FG_BLUE}Traveler & Admin JWT Authentication{RESET}")
    print(f"  {BOLD}{FG_ORANGE}[API:QUOTA ]{RESET} {FG_ORANGE}Third-Party API Quota & Milestone Traps{RESET}")
    print(f"  {BOLD}{FG_PINK}[API:ADMIN ]{RESET} {FG_PINK}Platform Analytics & Aggregates{RESET}")
    print(f"  {BOLD}{FG_AMBER}[WORKER:ALERT]{RESET} {FG_AMBER}Celery Worker: Alert Trigger & Idempotent State Flip{RESET}")
    print(f"  {BOLD}{FG_PURPLE}[WORKER:CRON ]{RESET} {FG_PURPLE}Celery Worker: Route Price Aggregation Check{RESET}")
    print(f"  {BOLD}{FG_PINK}[BEAT:TICK   ]{RESET} {FG_PINK}Celery Beat: 30-Second Periodic Fallback Dispatch{RESET}\n")

    # 1. Start Docker
    start_docker()

    # 2. Define service commands
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["FORCE_COLOR"] = "1"

    services = [
        ("BACKEND", [str(VENV_PYTHON), "manage.py", "runserver", "127.0.0.1:8000"], PROJECT_ROOT),
        ("WORKER", [str(VENV_CELERY), "-A", "config", "worker", "--loglevel=info", "--pool=solo"], PROJECT_ROOT),
        ("BEAT", [str(VENV_CELERY), "-A", "config", "beat", "--loglevel=info"], PROJECT_ROOT),
        ("FRONTEND", ["npm.cmd", "run", "dev"], FRONTEND_DIR),
    ]

    # 3. Launch services
    for tag, cmd, cwd in services:
        log("SYSTEM", f"Starting {tag} service...", FG_CYAN)
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                env=env
            )
            processes.append((tag, proc))

            t_out = threading.Thread(target=stream_reader, args=(tag, proc.stdout), daemon=True)
            t_err = threading.Thread(target=stream_reader, args=(tag, proc.stderr), daemon=True)
            t_out.start()
            t_err.start()
        except Exception as e:
            log("SYSTEM", f"Failed to start {tag}: {e}", FG_RED)

    # 4. Open browser after short delay
    def open_browser():
        time.sleep(3)
        if not is_shutting_down:
            log("SYSTEM", "Opening Flight Radar at http://localhost:5173 ...", FG_LIME)
            webbrowser.open("http://localhost:5173")

    threading.Thread(target=open_browser, daemon=True).start()

    log("SYSTEM", f"{BOLD}All services active! Press Ctrl+C at any time to shut down everything cleanly.{RESET}\n", FG_LIME)

    # 5. Keep main thread alive and wait for exit
    try:
        while not is_shutting_down:
            for tag, proc in processes:
                code = proc.poll()
                if code is not None and not is_shutting_down:
                    log(tag, f"Process exited with code {code}", FG_ORANGE)
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown()
    finally:
        shutdown()

if __name__ == "__main__":
    signal.signal(signal.SIGINT, lambda sig, frame: shutdown())
    signal.signal(signal.SIGTERM, lambda sig, frame: shutdown())
    main()
