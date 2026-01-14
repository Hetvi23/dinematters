# FastAPI Proxy - Deployment Guide

## 🔐 Handling .env File on Server

Since `.env` files should **NEVER** be committed to Git, here are the recommended approaches for deploying secrets to your server:

---

## Option 1: Manual Copy via SCP/SFTP (Recommended for Small Deployments)

### Step 1: Create .env on Local Machine
```bash
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy
# Edit .env with your credentials
nano .env
```

### Step 2: Copy to Server
```bash
# From your local machine
scp .env user@your-server:/home/frappe/frappe-bench/apps/dinematters/fastapi_proxy/.env

# Or use SFTP
sftp user@your-server
put .env /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy/.env
```

### Step 3: Set Permissions on Server
```bash
# SSH into server
ssh user@your-server

# Navigate to directory
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy

# Set secure permissions (only owner can read/write)
chmod 600 .env
```

---

## Option 2: Environment Variables on Server (Recommended for Production)

Instead of using a `.env` file, set environment variables directly on the server:

### Step 1: Create Environment File on Server
```bash
# SSH into server
ssh user@your-server

# Create environment file (not .env, but a systemd service file)
sudo nano /etc/systemd/system/fastapi-proxy.env
```

Add your variables:
```bash
ERPNEXT_BASE_URL=https://backend.dinematters.com
ERPNEXT_API_KEY=8838cf27200d3cf
ERPNEXT_API_SECRET=afd0c5591807ccb
JWT_SECRET_KEY=3cc5a7d3bdfa2287a7f693b371581a77d03879e045ecb4b1151973ca10b5fc65
# ... other variables
```

### Step 2: Secure the File
```bash
sudo chmod 600 /etc/systemd/system/fastapi-proxy.env
sudo chown frappe:frappe /etc/systemd/system/fastapi-proxy.env
```

### Step 3: Update Systemd Service
```ini
[Unit]
Description=DineMatters FastAPI Proxy
After=network.target

[Service]
Type=simple
User=frappe
WorkingDirectory=/home/frappe/frappe-bench/apps/dinematters/fastapi_proxy
EnvironmentFile=/etc/systemd/system/fastapi-proxy.env
ExecStart=/home/frappe/frappe-bench/apps/dinematters/fastapi_proxy/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8001
Restart=always

[Install]
WantedBy=multi-user.target
```

### Step 4: Reload and Start
```bash
sudo systemctl daemon-reload
sudo systemctl enable fastapi-proxy
sudo systemctl start fastapi-proxy
```

---

## Option 3: Use a Secrets Manager (Recommended for Large Deployments)

### AWS Secrets Manager
```python
import boto3
import os

def get_secret(secret_name):
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# In config.py
secrets = get_secret('dinematters/fastapi-proxy')
erpnext_api_key = secrets['ERPNEXT_API_KEY']
```

### HashiCorp Vault
```bash
# Store secrets
vault kv put secret/fastapi-proxy \
  ERPNEXT_API_KEY=8838cf27200d3cf \
  ERPNEXT_API_SECRET=afd0c5591807ccb

# Retrieve in application
vault kv get -field=ERPNEXT_API_KEY secret/fastapi-proxy
```

---

## Option 4: Create .env Template and Manual Setup

### Step 1: Keep .env.example in Git
```bash
# This file IS committed to Git
cp .env.example .env.example.template
git add .env.example.template
```

### Step 2: On Server, Create from Template
```bash
# SSH into server
ssh user@your-server
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy

# Copy template
cp .env.example .env

# Edit with your actual credentials
nano .env

# Secure it
chmod 600 .env
```

---

## 🔒 Security Best Practices

### 1. File Permissions
```bash
# Only owner can read/write
chmod 600 .env

# Verify permissions
ls -la .env
# Should show: -rw------- (600)
```

### 2. Never Commit .env
```bash
# Verify .gitignore includes .env
cat .gitignore | grep "\.env"

# If not, add it:
echo ".env" >> .gitignore
```

### 3. Use Different Credentials per Environment
- **Development**: Local credentials
- **Staging**: Staging credentials
- **Production**: Production credentials

### 4. Rotate Secrets Regularly
- Change JWT secret every 90 days
- Rotate API keys if compromised
- Use strong, random secrets

### 5. Backup Secrets Securely
```bash
# Encrypt before storing
gpg --encrypt --recipient your-email@example.com .env
# Store encrypted .env.gpg in secure location
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Create .env file with production credentials
- [ ] Verify all required variables are set
- [ ] Test configuration locally with production URL
- [ ] Ensure .env is in .gitignore

### On Server
- [ ] Copy .env to server (via SCP/SFTP)
- [ ] Set file permissions (chmod 600)
- [ ] Verify environment variables load correctly
- [ ] Test connection to ERPNext backend
- [ ] Test JWT token generation

### Post-Deployment
- [ ] Verify service starts without errors
- [ ] Test health check endpoint
- [ ] Test authentication flow
- [ ] Monitor logs for errors
- [ ] Document credentials location (securely)

---

## 🚀 Quick Deployment Script

Create a deployment script to automate the process:

```bash
#!/bin/bash
# deploy.sh

SERVER="user@your-server"
REMOTE_PATH="/home/frappe/frappe-bench/apps/dinematters/fastapi_proxy"

echo "Deploying FastAPI Proxy..."

# Copy code (excluding .env)
rsync -avz --exclude '.env' --exclude 'venv' --exclude '__pycache__' \
  ./ $SERVER:$REMOTE_PATH/

# Copy .env separately (manual step for security)
echo "⚠️  Remember to copy .env file manually:"
echo "scp .env $SERVER:$REMOTE_PATH/.env"
echo "ssh $SERVER 'chmod 600 $REMOTE_PATH/.env'"

# Restart service on server
ssh $SERVER "cd $REMOTE_PATH && sudo systemctl restart fastapi-proxy"
```

---

## 🔍 Verifying Configuration

### Test Configuration Loads
```bash
# On server
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy
source venv/bin/activate
python -c "from config import settings; print('✅ Config loaded:', settings.erpnext_base_url)"
```

### Test ERPNext Connection
```bash
python -c "
from clients.erpnext_client import get_erpnext_client
import asyncio

async def test():
    client = get_erpnext_client()
    print('✅ ERPNext client initialized')
    # Test connection
    result = await client.call_method('ping', data={})
    print('✅ Connection test:', result)

asyncio.run(test())
"
```

### Test JWT Secret
```bash
python -c "
from utils.auth import create_access_token, verify_token

token = create_access_token({'user_id': 'test', 'email': 'test@test.com'})
print('✅ JWT token created:', token[:20] + '...')

decoded = verify_token(token)
print('✅ JWT token verified:', decoded.user_id)
"
```

---

## 📞 Troubleshooting

### Issue: "Configuration is incomplete"
**Solution**: Check all required variables are set in .env

### Issue: "Cannot connect to ERPNext"
**Solution**: 
- Verify `ERPNEXT_BASE_URL` is correct
- Check network connectivity
- Verify API key/secret are correct

### Issue: "JWT secret too short"
**Solution**: Generate new secret: `openssl rand -hex 32`

### Issue: "Permission denied reading .env"
**Solution**: Check file permissions: `chmod 600 .env`

---

## 💡 Recommended Approach

For **production**, I recommend **Option 2** (Environment Variables via Systemd):

✅ More secure (not in project directory)  
✅ Easier to manage (systemd handles it)  
✅ Better for multiple environments  
✅ Follows Linux best practices  

For **development/staging**, use **Option 1** (Manual .env copy):

✅ Simple and straightforward  
✅ Easy to update  
✅ Works with any deployment method  

