# Check What's Running on Port 8001

## Safe Commands (Read-Only - Won't Kill Anything)

### 1. Check What Process is Using Port 8001
```bash
sudo lsof -i :8001
# or
sudo ss -tlnp | grep 8001
```

### 2. Check Process Details
```bash
# Get the PID from above, then:
ps -p <PID> -o pid,user,cmd,etime
# Example: ps -p 684821 -o pid,user,cmd,etime
```

### 3. Check if it's an ERPNext Site
```bash
# Check if it's a bench/frappe process
ps aux | grep -E "(684821|684822|684823|684824)" | grep -E "(bench|frappe|python.*site)"
```

### 4. Check ERPNext Sites
```bash
# List all ERPNext sites
bench --site all list-apps 2>/dev/null || ls /home/frappe/frappe-bench/sites/
```

### 5. Check if Port 8001 is in ERPNext Config
```bash
# Check nginx config for port 8001
sudo grep -r "8001" /etc/nginx/ 2>/dev/null
```

## Safe Solution: Change FastAPI Port

If port 8001 is being used by ERPNext or another service, change FastAPI to a different port:

### Option 1: Use Port 8002 (Recommended)
```bash
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy
nano .env
# Change: FASTAPI_PORT=8002
```

Then update systemd service:
```bash
sudo nano /etc/systemd/system/fastapi-proxy.service
# Change: --bind 0.0.0.0:8002
```

### Option 2: Use Port 9000
```bash
# Same steps, use port 9000
```

## Check Before Killing

**NEVER kill processes without checking first!**

```bash
# 1. Identify the process
sudo lsof -i :8001

# 2. Check what it is
ps -p <PID> -f

# 3. Check if it's important
# If it shows "bench" or "frappe" or site name, it's ERPNext - DON'T KILL

# 4. Only kill if it's clearly a stale/old process
```

## ERPNext Ports

- **Port 8000**: Main ERPNext (default)
- **Port 8001**: Could be another ERPNext site
- **Port 8002+**: Other ERPNext sites

FastAPI can use:
- **Port 9000**: Safe choice
- **Port 8002**: If not used
- **Port 3001**: Alternative
