# Debug Stuck Service

## Quick Checks

### 1. Check Service Status
```bash
systemctl status fastapi-proxy
```

### 2. Check if Port 9000 is Listening
```bash
sudo ss -tlnp | grep 9000
```

### 3. Check Service Logs (Most Important)
```bash
journalctl -u fastapi-proxy -n 50 --no-pager
```

### 4. Check for Errors
```bash
journalctl -u fastapi-proxy --since "5 minutes ago" | grep -i "error\|exception\|traceback\|failed"
```

### 5. Check if Process is Running
```bash
ps aux | grep gunicorn | grep 9000
```

## If Service is Stuck

### Option 1: Stop and Check Logs
```bash
systemctl stop fastapi-proxy
journalctl -u fastapi-proxy -n 100 --no-pager
```

### Option 2: Test Manual Start
```bash
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy
source venv/bin/activate
gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind 127.0.0.1:9000 --log-level debug
```

This will show errors directly in terminal.

### Option 3: Check Configuration
```bash
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy
source venv/bin/activate
python -c "from config import settings; print('Port:', settings.fastapi_port)"
```

## Common Issues

### Issue: Port Already in Use
```bash
sudo lsof -i :9000
```

### Issue: Configuration Error
Check .env file:
```bash
cat /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy/.env | grep FASTAPI_PORT
```

### Issue: Import Error
Check logs for Python import errors.
