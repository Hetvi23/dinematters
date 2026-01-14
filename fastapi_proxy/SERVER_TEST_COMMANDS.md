# Server Testing Commands

## Test Direct Connection (Bypass Gateway)

### 1. Test with 127.0.0.1 (instead of localhost)
```bash
curl http://127.0.0.1:8001/health
```

### 2. Test with verbose output to see what's happening
```bash
curl -v http://127.0.0.1:8001/health
```

### 3. Test root endpoint
```bash
curl http://127.0.0.1:8001/
```

### 4. Check what's actually listening on port 8001
```bash
sudo netstat -tlnp | grep 8001
# or
sudo ss -tlnp | grep 8001
```

### 5. Check if there's a reverse proxy (Nginx) intercepting
```bash
# Check Nginx config
sudo nginx -t
sudo cat /etc/nginx/sites-enabled/* | grep -i "8001\|fastapi\|localhost" -A 5 -B 5
```

### 6. Check service logs to see if requests are reaching FastAPI
```bash
journalctl -u fastapi-proxy -f
# In another terminal, run: curl http://127.0.0.1:8001/health
# Press Ctrl+C to stop watching logs
```

## If Gateway is Intercepting

### Option 1: Access Directly via 127.0.0.1
Always use `127.0.0.1` instead of `localhost`:
```bash
curl http://127.0.0.1:8001/health
```

### Option 2: Check Nginx Configuration
If Nginx is routing localhost requests:

```bash
# View Nginx config
sudo cat /etc/nginx/sites-enabled/default
# or
sudo cat /etc/nginx/sites-enabled/*.conf
```

Look for:
- `proxy_pass` directives pointing to port 8001
- `server_name localhost` blocks
- Any routing rules for `/health` or port 8001

### Option 3: Test from Different Interface
```bash
# Get server's actual IP
hostname -I

# Test from that IP (if accessible)
curl http://$(hostname -I | awk '{print $1}'):8001/health
```

## Verify Service is Actually Running

### Check Process
```bash
ps aux | grep gunicorn | grep -v grep
```

Should show:
```
frappe  693146  ... gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8001
```

### Check Listening Ports
```bash
sudo lsof -i :8001
```

Should show:
```
COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
python3  693146 frappe ... TCP *:8001 (LISTEN)
```

### Check Service Logs for Startup
```bash
journalctl -u fastapi-proxy --since "1 hour ago" | grep -i "started\|listening\|bind\|error" | tail -20
```

## Quick Test Script

Run this on server:

```bash
echo "=== Testing 127.0.0.1 ==="
curl -s http://127.0.0.1:8001/health
echo -e "\n"

echo "=== Testing localhost ==="
curl -s http://localhost:8001/health
echo -e "\n"

echo "=== Port Status ==="
sudo netstat -tlnp | grep 8001

echo -e "\n=== Process Status ==="
ps aux | grep gunicorn | grep -v grep | head -1

echo -e "\n=== Recent Logs ==="
journalctl -u fastapi-proxy -n 10 --no-pager | tail -5
```
