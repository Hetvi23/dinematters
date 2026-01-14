# FastAPI Proxy Shield - Implementation Guide

**Status**: Foundation Complete ✅  
**Next Steps**: Route Implementation & Testing  
**Date**: 2026-01-13

---

## 🎯 WHAT WE'VE BUILT

### ✅ Part 1: ERPNext Backend (COMPLETE)

1. **API Inventory** (`API_INVENTORY.md`)
   - Documented all 20 APIs used by frontend
   - Classified READ vs WRITE APIs
   - Identified which need wrappers

2. **Wrapper APIs** (`dinematters/dinematters/api/documents.py`)
   - ✅ `get_doc_list()` - Wrapper for `frappe.client.get_list`
   - ✅ `get_doc()` - Wrapper for `frappe.client.get`
   - ✅ `insert_doc()` - Wrapper for `frappe.client.insert`
   - ✅ `delete_doc()` - Wrapper for `frappe.client.delete`
   - ✅ `update_document()` - Already existed
   - ✅ `create_document()` - Already existed

3. **System User Script** (`dinematters/setup/create_fastapi_user.py`)
   - Script to create FastAPI system user
   - Generates API key + secret
   - Ready to execute

### ✅ Part 2: FastAPI Service Foundation (COMPLETE)

**Directory Structure**:
```
fastapi_proxy/
├── __init__.py
├── main.py                    # FastAPI app entry point
├── config.py                  # Configuration management
├── requirements.txt           # Python dependencies
├── .env.example              # Environment template
├── clients/
│   ├── __init__.py
│   └── erpnext_client.py    # ERPNext HTTP client
├── middleware/
│   ├── __init__.py
│   ├── logging.py           # Logging setup
│   └── error_handler.py     # Error handling
├── utils/
│   ├── __init__.py
│   └── auth.py              # JWT authentication
└── routes/                   # TO BE CREATED
    ├── __init__.py
    ├── ui_routes.py
    ├── order_routes.py
    ├── document_routes.py
    ├── restaurant_routes.py
    ├── frappe_routes.py
    └── resource_routes.py
```

**Core Components Created**:
- ✅ FastAPI application structure
- ✅ Configuration management (environment-based)
- ✅ ERPNext HTTP client (with system user auth)
- ✅ JWT authentication utilities
- ✅ Error handling middleware
- ✅ Logging setup (JSON format)
- ✅ CORS configuration
- ✅ Health check endpoint

---

## 🚧 WHAT'S REMAINING

### ⏳ Part 2: Route Implementation (TODO)

Need to create 6 route modules that map 1:1 to ERPNext APIs:

#### 1. UI Routes (`routes/ui_routes.py`)
Map these endpoints:
- `POST /api/method/dinematters.dinematters.api.ui.get_doctype_meta`
- `POST /api/method/dinematters.dinematters.api.ui.get_user_permissions`
- `POST /api/method/dinematters.dinematters.api.ui.get_all_doctypes`
- `POST /api/method/dinematters.dinematters.api.ui.get_user_restaurants`
- `POST /api/method/dinematters.dinematters.api.ui.get_restaurant_setup_progress`
- `POST /api/method/dinematters.dinematters.api.ui.get_setup_wizard_steps`

#### 2. Order Routes (`routes/order_routes.py`)
- `POST /api/method/dinematters.dinematters.api.order_status.update_status`
- `POST /api/method/dinematters.dinematters.api.order_status.update_table_number`

#### 3. Document Routes (`routes/document_routes.py`)
- `POST /api/method/dinematters.dinematters.api.documents.create_document`
- `POST /api/method/dinematters.dinematters.api.documents.update_document`
- `POST /api/method/dinematters.dinematters.api.documents.get_doc_list`
- `POST /api/method/dinematters.dinematters.api.documents.get_doc`
- `POST /api/method/dinematters.dinematters.api.documents.insert_doc`
- `POST /api/method/dinematters.dinematters.api.documents.delete_doc`

#### 4. Restaurant Routes (`routes/restaurant_routes.py`)
- `POST /api/method/dinematters.dinematters.doctype.restaurant.restaurant.generate_qr_codes_pdf`
- `POST /api/method/dinematters.dinematters.doctype.restaurant.restaurant.get_qr_codes_pdf_url`

#### 5. Frappe Client Routes (`routes/frappe_routes.py`)
Map to wrappers:
- `POST /api/method/frappe.client.get_list` → `get_doc_list`
- `POST /api/method/frappe.client.get` → `get_doc`
- `POST /api/method/frappe.client.insert` → `insert_doc`
- `POST /api/method/frappe.client.delete` → `delete_doc`

#### 6. Resource API Routes (`routes/resource_routes.py`)
Map to wrappers:
- `GET /api/resource/{doctype}` → `get_doc_list`
- `GET /api/resource/{doctype}/{name}` → `get_doc`
- `PUT /api/resource/{doctype}/{name}` → `update_document`
- `DELETE /api/resource/{doctype}/{name}` → `delete_doc`

### ⏳ Part 2: Rate Limiting (TODO)

Add rate limiting decorators to routes:
- READ APIs: 100/min per user
- WRITE APIs: 20/min per user
- Global: 1000/min per IP

### ⏳ Part 2: Caching (TODO)

Add Redis caching for READ-only APIs:
- Cache only specific endpoints (see `API_INVENTORY.md`)
- Short TTL (30-60 seconds)
- NEVER cache WRITE APIs
- NEVER cache user-specific data

---

## 📋 STEP-BY-STEP EXECUTION GUIDE

### Step 1: Create ERPNext System User

```bash
# Navigate to frappe-bench
cd /home/frappe/frappe-bench

# Execute the system user creation script
bench --site [your-site-name] execute dinematters.setup.create_fastapi_user.create_fastapi_system_user

# IMPORTANT: Save the API key and secret that are printed!
# You will need them for .env configuration
```

### Step 2: Configure FastAPI Environment

```bash
# Navigate to fastapi_proxy directory
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy

# Copy .env.example to .env
cp .env.example .env

# Edit .env and fill in the values
nano .env

# Required values:
# - ERPNEXT_BASE_URL (e.g., http://localhost:8000)
# - ERPNEXT_API_KEY (from Step 1)
# - ERPNEXT_API_SECRET (from Step 1)
# - JWT_SECRET_KEY (generate: openssl rand -hex 32)
```

### Step 3: Install FastAPI Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 4: Implement Route Modules

For each route module (ui_routes, order_routes, etc.):

**Template** (`routes/ui_routes.py`):
```python
"""UI API routes - mirrors ERPNext UI API endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from ..clients.erpnext_client import get_erpnext_client
from ..utils.auth import get_current_user, TokenData

logger = logging.getLogger(__name__)
router = APIRouter()


class GetDoctypeMetaRequest(BaseModel):
	"""Request model for get_doctype_meta"""
	doctype: str


@router.post("/get_doctype_meta")
async def get_doctype_meta(
	request: GetDoctypeMetaRequest,
	current_user: TokenData = Depends(get_current_user)
):
	"""
	Get doctype metadata
	
	Mirrors: dinematters.dinematters.api.ui.get_doctype_meta
	"""
	client = get_erpnext_client()
	
	try:
		response = await client.call_method(
			"dinematters.dinematters.api.ui.get_doctype_meta",
			data=request.dict()
		)
		return response
	except Exception as e:
		logger.error(f"Error calling get_doctype_meta: {str(e)}")
		raise HTTPException(status_code=500, detail=str(e))


# ... repeat for all other UI endpoints
```

**Key Points**:
1. Each route MUST accept exact same parameters as ERPNext
2. Each route MUST return exact same response as ERPNext
3. Use `get_current_user` dependency for authenticated routes
4. Use Pydantic models to validate request data
5. NO transformation of requests or responses

### Step 5: Add Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/get_doctype_meta")
@limiter.limit("100/minute")  # READ API
async def get_doctype_meta(...):
	...

@router.post("/update_status")
@limiter.limit("20/minute")  # WRITE API
async def update_status(...):
	...
```

### Step 6: Add Caching (Redis)

```python
import redis
from ..config import settings

redis_client = redis.from_url(settings.cache_redis_url)

@router.post("/get_doctype_meta")
async def get_doctype_meta(request: GetDoctypeMetaRequest, ...):
	# Try cache first
	cache_key = f"doctype_meta:{request.doctype}"
	cached = redis_client.get(cache_key)
	
	if cached:
		return json.loads(cached)
	
	# Call ERPNext
	response = await client.call_method(...)
	
	# Cache result
	redis_client.setex(
		cache_key,
		settings.cache_doctype_meta_ttl,
		json.dumps(response)
	)
	
	return response
```

### Step 7: Test Locally

```bash
# Start FastAPI
cd /home/frappe/frappe-bench/apps/dinematters/fastapi_proxy
python -m main

# Should see:
# INFO: Uvicorn running on http://0.0.0.0:8001
```

Test endpoints:
```bash
# Health check
curl http://localhost:8001/health

# Test API (need JWT token first)
curl -X POST http://localhost:8001/api/method/dinematters.dinematters.api.ui.get_doctype_meta \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"doctype": "Restaurant"}'
```

### Step 8: Manual Verification (CRITICAL)

For **EVERY** API endpoint:

1. **Direct ERPNext Call** (baseline):
```bash
curl -X POST http://localhost:8000/api/method/dinematters.dinematters.api.ui.get_doctype_meta \
  -H "Authorization: token API_KEY:API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"doctype": "Restaurant"}' > erpnext_response.json
```

2. **FastAPI Proxy Call**:
```bash
curl -X POST http://localhost:8001/api/method/dinematters.dinematters.api.ui.get_doctype_meta \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"doctype": "Restaurant"}' > fastapi_response.json
```

3. **Compare**:
```bash
# Must be IDENTICAL
diff erpnext_response.json fastapi_response.json
```

**Verification Checklist** (per API):
- [ ] Parameters match exactly
- [ ] Response JSON structure identical
- [ ] All keys present
- [ ] All values have same types
- [ ] Error responses match
- [ ] HTTP status codes match
- [ ] Side effects identical (database changes, files, etc.)

### Step 9: Update Frontend Configuration

Once verified, update frontend to point to FastAPI:

**Before** (`frontend/.env`):
```
VITE_API_URL=http://localhost:8000
```

**After**:
```
VITE_API_URL=http://localhost:8001
```

### Step 10: Deployment

1. **Install Redis**:
```bash
sudo apt install redis-server
sudo systemctl start redis
```

2. **Production .env**:
```bash
FASTAPI_ENV=production
FASTAPI_DEBUG=false
LOG_LEVEL=WARNING
```

3. **Run with Gunicorn** (production):
```bash
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8001
```

4. **Setup Nginx** (reverse proxy):
```nginx
server {
	listen 80;
	server_name api.dinematters.com;
	
	location / {
		proxy_pass http://127.0.0.1:8001;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
	}
}
```

---

## 🚨 GOLDEN RULES (NEVER VIOLATE)

1. **NO Logic Changes**: FastAPI MUST NOT contain any business logic
2. **NO Transformations**: Requests and responses pass through UNCHANGED
3. **NO Field Renaming**: All field names must match ERPNext exactly
4. **NO Optimizations**: Don't try to "improve" ERPNext APIs
5. **NO Assumptions**: Verify everything with actual API calls
6. **NO Caching WRITE APIs**: Only cache READ endpoints with short TTL
7. **NO Direct Resource Access**: Frontend must not call `/api/resource/*` directly

---

## 📊 PROGRESS TRACKING

### Completed ✅
- [x] API Inventory (20 APIs documented)
- [x] API Classification (READ/WRITE, custom/resource)
- [x] Wrapper APIs in ERPNext (4 new wrappers)
- [x] System User Creation Script
- [x] FastAPI Project Structure
- [x] Configuration Management
- [x] ERPNext HTTP Client
- [x] JWT Authentication
- [x] Error Handling Middleware
- [x] Logging Setup

### In Progress ⏳
- [ ] Route Modules (6 files)
  - [ ] ui_routes.py
  - [ ] order_routes.py
  - [ ] document_routes.py
  - [ ] restaurant_routes.py
  - [ ] frappe_routes.py
  - [ ] resource_routes.py
- [ ] Rate Limiting Implementation
- [ ] Caching Implementation (Redis)

### Not Started ❌
- [ ] Manual Verification (all 20 APIs)
- [ ] Frontend Configuration Update
- [ ] Integration Testing
- [ ] Production Deployment

---

## 🆘 TROUBLESHOOTING

### Issue: "ERPNext client configuration is incomplete"
**Fix**: Check `.env` file has all required values (ERPNEXT_BASE_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET)

### Issue: "Invalid token"
**Fix**: JWT token expired or invalid. Generate new token via login endpoint.

### Issue: "Connection refused to ERPNext"
**Fix**: Ensure ERPNext is running on configured URL. Check `ERPNEXT_BASE_URL`.

### Issue: "Responses don't match"
**Fix**: This is a CRITICAL error. Review the route implementation - it must NOT transform responses.

### Issue: "Rate limit exceeded"
**Fix**: Adjust rate limits in `.env` or implement per-user tracking.

---

## 📞 NEXT IMMEDIATE STEPS

1. **Create ERPNext System User**:
   ```bash
   bench --site [site] execute dinematters.setup.create_fastapi_user.create_fastapi_system_user
   ```

2. **Configure FastAPI .env**:
   - Copy .env.example to .env
   - Fill in ERPNEXT credentials
   - Generate JWT secret

3. **Implement Route Modules**:
   - Start with `ui_routes.py` (6 endpoints)
   - Test each endpoint against ERPNext
   - Verify responses match EXACTLY

4. **Add Rate Limiting & Caching**:
   - Apply rate limits per API type (READ/WRITE)
   - Add Redis caching for READ APIs only
   - NEVER cache WRITE APIs

5. **Manual Verification**:
   - Test ALL 20 APIs
   - Compare responses with ERPNext direct calls
   - Document any differences (MUST be fixed)

---

**Remember**: The goal is a TRANSPARENT proxy. If frontend behavior changes in any way, the implementation has failed.

