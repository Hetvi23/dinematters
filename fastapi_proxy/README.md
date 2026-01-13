# FastAPI Proxy Shield for DineMatters

A transparent, protective API layer that sits between the frontend and ERPNext backend.

## 🎯 Purpose

This FastAPI proxy acts as a security and performance shield while maintaining 100% API compatibility with ERPNext. It introduces:
- Authentication (JWT)
- Rate limiting
- Caching (READ-only)
- Request logging
- Error handling

**WITHOUT**:
- Changing any ERPNext business logic
- Modifying API contracts
- Transforming requests or responses
- Altering frontend behavior

## 🏗️ Architecture

```
Frontend (React)
    ↓ HTTP/JWT
FastAPI Proxy (Port 8001)
    ↓ HTTP/API Key
ERPNext (Port 8000)
```

### Key Components

- **ERPNext Client** (`clients/erpnext_client.py`): HTTP client for ERPNext communication
- **Authentication** (`utils/auth.py`): JWT token management
- **Routes** (`routes/*.py`): 1:1 mapping to ERPNext APIs
- **Config** (`config.py`): Environment-based configuration
- **Middleware**: Logging, error handling

## 📋 Prerequisites

- Python 3.8+
- Redis (for caching)
- ERPNext instance running
- System user with API credentials

## 🚀 Quick Start

### 1. Create ERPNext System User

```bash
cd /home/frappe/frappe-bench
bench --site [your-site] execute dinematters.setup.create_fastapi_user.create_fastapi_system_user
```

**IMPORTANT**: Save the API key and secret printed!

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Required values:
```bash
ERPNEXT_BASE_URL=https://backend.dinematters.com
ERPNEXT_API_KEY=<from step 1>
ERPNEXT_API_SECRET=<from step 1>
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
```

### 3. Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Start Server

```bash
python -m main
```

Server starts on `http://0.0.0.0:8001`

### 5. Health Check

```bash
curl http://localhost:8001/health
```

## 📚 API Documentation

When running in debug mode, access:
- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

## 🔐 Authentication

FastAPI uses JWT tokens for frontend authentication:

1. **Login** (to be implemented): Get JWT token
2. **Use Token**: Include in Authorization header
   ```
   Authorization: Bearer <jwt_token>
   ```

## 🛣️ API Routes

All routes mirror ERPNext endpoints exactly:

### UI APIs
- `POST /api/method/dinematters.dinematters.api.ui.get_doctype_meta`
- `POST /api/method/dinematters.dinematters.api.ui.get_user_permissions`
- `POST /api/method/dinematters.dinematters.api.ui.get_all_doctypes`
- `POST /api/method/dinematters.dinematters.api.ui.get_user_restaurants`
- `POST /api/method/dinematters.dinematters.api.ui.get_restaurant_setup_progress`
- `POST /api/method/dinematters.dinematters.api.ui.get_setup_wizard_steps`

### Order Management
- `POST /api/method/dinematters.dinematters.api.order_status.update_status`
- `POST /api/method/dinematters.dinematters.api.order_status.update_table_number`

### Document Management
- `POST /api/method/dinematters.dinematters.api.documents.*`

### Restaurant
- `POST /api/method/dinematters.dinematters.doctype.restaurant.restaurant.*`

### Frappe Client (mapped to wrappers)
- `POST /api/method/frappe.client.*`

### Resource API (mapped to wrappers)
- `GET /api/resource/{doctype}`
- `GET /api/resource/{doctype}/{name}`
- `PUT /api/resource/{doctype}/{name}`
- `DELETE /api/resource/{doctype}/{name}`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ERPNEXT_BASE_URL` | ERPNext backend URL | - |
| `ERPNEXT_API_KEY` | System user API key | - |
| `ERPNEXT_API_SECRET` | System user API secret | - |
| `FASTAPI_HOST` | FastAPI bind host | 0.0.0.0 |
| `FASTAPI_PORT` | FastAPI bind port | 8001 |
| `FASTAPI_ENV` | Environment (dev/prod) | development |
| `JWT_SECRET_KEY` | JWT signing key | - |
| `JWT_EXPIRATION_MINUTES` | Token expiration | 60 |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | true |
| `CACHE_ENABLED` | Enable caching | true |
| `CACHE_REDIS_URL` | Redis connection URL | redis://localhost:6379/0 |
| `LOG_LEVEL` | Logging level | INFO |

### Rate Limits

- **READ APIs**: 100 requests/minute per user
- **WRITE APIs**: 20 requests/minute per user
- **Global**: 1000 requests/minute per IP

### Caching

Only READ APIs are cached:
- DocType meta: 60s
- Permissions: 30s
- Doctypes list: 300s
- Restaurants: 60s
- Categories: 600s
- Products: 300s

WRITE APIs and real-time data are **NEVER** cached.

## 🧪 Testing

### Manual Verification

Test each API against ERPNext direct:

```bash
# Direct ERPNext call
curl -X POST http://localhost:8000/api/method/dinematters.dinematters.api.ui.get_doctype_meta \
  -H "Authorization: token API_KEY:API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"doctype": "Restaurant"}' > erpnext.json

# FastAPI proxy call
curl -X POST http://localhost:8001/api/method/dinematters.dinematters.api.ui.get_doctype_meta \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"doctype": "Restaurant"}' > fastapi.json

# Compare (must be identical)
diff erpnext.json fastapi.json
```

## 🚀 Production Deployment

### Using Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8001
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.dinematters.com;
    
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Systemd Service

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

[Install]
WantedBy=multi-user.target
```

## 🛠️ Development

### Project Structure

```
fastapi_proxy/
├── main.py                 # FastAPI application
├── config.py              # Configuration
├── clients/
│   └── erpnext_client.py # ERPNext client
├── middleware/
│   ├── logging.py        # Logging
│   └── error_handler.py  # Error handling
├── routes/
│   ├── ui_routes.py      # UI APIs
│   ├── order_routes.py   # Order APIs (TODO)
│   ├── document_routes.py # Document APIs (TODO)
│   ├── restaurant_routes.py # Restaurant APIs (TODO)
│   ├── frappe_routes.py  # Frappe client APIs (TODO)
│   └── resource_routes.py # Resource APIs (TODO)
└── utils/
    └── auth.py           # Authentication
```

### Adding New Routes

1. Create route module in `routes/`
2. Use existing routes as template
3. Import and register in `main.py`
4. Test against ERPNext direct call
5. Verify responses match exactly

## 📖 Documentation

- **API_INVENTORY.md**: Complete API list
- **FASTAPI_IMPLEMENTATION_GUIDE.md**: Step-by-step guide
- **FASTAPI_PROXY_SUMMARY.md**: Overview and status

## ⚠️ Important Rules

1. **NO business logic** - only routing, auth, caching
2. **NO transformations** - requests and responses pass through unchanged
3. **NO field renaming** - maintain exact API contracts
4. **NO assumptions** - verify everything
5. **NO caching WRITE APIs** - only READ endpoints
6. **NO direct resource access** - frontend uses FastAPI only

## 🐛 Troubleshooting

### Connection Refused
- Check ERPNext is running: `curl http://localhost:8000`
- Verify `ERPNEXT_BASE_URL` in `.env`

### Invalid Token
- JWT token expired (default: 60 minutes)
- Check `JWT_SECRET_KEY` matches between token creation and verification

### API Errors
- Check ERPNext logs: `tail -f logs/web.error.log`
- Check FastAPI logs: console output
- Verify API key/secret are correct

### Response Mismatch
- **CRITICAL**: Responses MUST match ERPNext exactly
- Check for transformation in route code
- Compare JSON responses field-by-field

## 📞 Support

For issues or questions:
1. Check documentation in `docs/` folder
2. Review ERPNext logs
3. Verify configuration in `.env`
4. Test ERPNext API directly (bypass FastAPI)

## 🔒 Security

- Store API keys in `.env` (never commit)
- Use strong JWT secret (32+ characters)
- Enable rate limiting in production
- Use HTTPS in production
- Review logs regularly

## 📜 License

Same as DineMatters ERPNext app.

