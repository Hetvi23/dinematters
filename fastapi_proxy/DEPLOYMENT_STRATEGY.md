# FastAPI Proxy - Deployment Strategy

## 🏗️ Architecture Overview

FastAPI Proxy is a **separate service** that runs independently from the main ERPNext application.

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │ HTTP/JWT
         ▼
┌─────────────────┐      ┌──────────────────┐
│  FastAPI Proxy  │──────│   ERPNext        │
│  (Port 8001)    │ HTTP │   (Port 8000)    │
│  Separate       │      │   Main App       │
│  Service        │      │                  │
└─────────────────┘      └──────────────────┘
```

## 📦 Deployment Options

### Option 1: Deploy Together (Same Server, Different Services)

Both ERPNext and FastAPI run on the same server but as separate services:

**ERPNext**: 
- Runs via `bench start` or systemd
- Port: 8000
- Path: `/home/frappe/frappe-bench`

**FastAPI Proxy**:
- Runs via systemd or gunicorn
- Port: 8001
- Path: `/home/frappe/frappe-bench/apps/dinematters/fastapi_proxy`

**Deployment Steps**:
1. Push code to GitHub (FastAPI code included)
2. Pull on server: `git pull origin main`
3. Deploy ERPNext: `bench restart` (if needed)
4. Deploy FastAPI separately (see below)

### Option 2: Deploy Separately (Different Servers)

**ERPNext Server**:
- Main application
- Handles business logic
- Port: 8000

**FastAPI Server**:
- API proxy service
- Handles auth, rate limiting, caching
- Port: 8001
- Connects to ERPNext via HTTPS

**Deployment Steps**:
1. Push code to GitHub
2. **ERPNext Server**: Pull and restart ERPNext
3. **FastAPI Server**: Pull code, setup venv, configure .env, start service

## 🚀 Recommended Deployment Flow

### Step 1: Push to GitHub

```bash
cd /home/frappe/frappe-bench/apps/dinematters

# Add all new files (except .env which is in .gitignore)
git add API_INVENTORY.md
git add FASTAPI_IMPLEMENTATION_GUIDE.md
git add FASTAPI_PROXY_SUMMARY.md
git add dinematters/setup/
git add dinematters/dinematters/api/documents.py
git add fastapi_proxy/

# Verify .env is NOT included
git status | grep .env
# Should show nothing (or show it's ignored)

# Commit
git commit -m "Add FastAPI Proxy Shield foundation

- Complete API inventory (20 APIs documented)
- ERPNext wrapper methods (4 new APIs)
- FastAPI service structure
- ERPNext client with system user auth
- JWT authentication system
- Configuration management
- Example route module (ui_routes)
- Comprehensive documentation"

# Push
git push origin main
```

### Step 2: Deploy on Server

#### For Same Server Deployment:

```bash
# SSH into server
ssh user@your-server

# Navigate to app directory
cd /home/frappe/frappe-bench/apps/dinematters

# Pull latest code
git pull origin main

# ERPNext changes (if any) - restart if needed
cd /home/frappe/frappe-bench
bench restart  # Only if ERPNext code changed

# FastAPI Proxy setup (first time only)
cd apps/dinematters/fastapi_proxy

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (manually - not from git)
cp .env.example .env
nano .env  # Fill in credentials

# Secure .env
chmod 600 .env

# Test configuration
python -c "from config import settings; print('Config OK:', settings.erpnext_base_url)"

# Create systemd service
sudo nano /etc/systemd/system/fastapi-proxy.service
```

#### Systemd Service File:

```ini
[Unit]
Description=DineMatters FastAPI Proxy
After=network.target

[Service]
Type=simple
User=frappe
WorkingDirectory=/home/frappe/frappe-bench/apps/dinematters/fastapi_proxy
Environment="PATH=/home/frappe/frappe-bench/apps/dinematters/fastapi_proxy/venv/bin"
ExecStart=/home/frappe/frappe-bench/apps/dinematters/fastapi_proxy/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Enable and Start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable fastapi-proxy
sudo systemctl start fastapi-proxy
sudo systemctl status fastapi-proxy
```

### Step 3: Update Nginx (if using reverse proxy)

```nginx
# ERPNext (existing)
server {
    listen 80;
    server_name backend.dinematters.com;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        # ... existing config
    }
}

# FastAPI Proxy (new)
server {
    listen 80;
    server_name api.dinematters.com;  # or use subpath
    
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔄 Update Workflow

### When ERPNext Code Changes:

```bash
# On server
cd /home/frappe/frappe-bench/apps/dinematters
git pull origin main
cd /home/frappe/frappe-bench
bench restart
```

### When FastAPI Code Changes:

```bash
# On server
cd /home/frappe/frappe-bench/apps/dinematters
git pull origin main
cd fastapi_proxy

# If dependencies changed
source venv/bin/activate
pip install -r requirements.txt

# Restart FastAPI service
sudo systemctl restart fastapi-proxy
```

### When Both Change:

```bash
# Pull once
cd /home/frappe/frappe-bench/apps/dinematters
git pull origin main

# Restart ERPNext
cd /home/frappe/frappe-bench
bench restart

# Restart FastAPI
cd apps/dinematters/fastapi_proxy
sudo systemctl restart fastapi-proxy
```

## 📋 Deployment Checklist

### Pre-Push
- [ ] `.env` is in `.gitignore`
- [ ] All code changes committed
- [ ] Documentation updated
- [ ] No secrets in code

### Post-Push (On Server)
- [ ] Pull latest code
- [ ] `.env` file exists (manually created)
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] Configuration tested
- [ ] Systemd service created
- [ ] Service enabled and started
- [ ] Health check passes
- [ ] Nginx configured (if needed)

## 🎯 Key Points

1. **FastAPI is Separate**: It's a different service, not part of ERPNext
2. **Same Repository**: Code is in same repo, but deployed separately
3. **Different Ports**: ERPNext (8000), FastAPI (8001)
4. **Independent Restarts**: Can restart one without affecting the other
5. **Shared Codebase**: Both pull from same git repo
6. **Separate Config**: FastAPI has its own `.env` file

## 🔐 Security Reminders

- ✅ `.env` is in `.gitignore` (never committed)
- ✅ `.env` must be created manually on server
- ✅ Use `chmod 600 .env` to secure it
- ✅ Different credentials per environment
- ✅ Rotate secrets regularly

## 📞 Quick Reference

**Start FastAPI**: `sudo systemctl start fastapi-proxy`  
**Stop FastAPI**: `sudo systemctl stop fastapi-proxy`  
**Restart FastAPI**: `sudo systemctl restart fastapi-proxy`  
**View Logs**: `sudo journalctl -u fastapi-proxy -f`  
**Check Status**: `sudo systemctl status fastapi-proxy`  

