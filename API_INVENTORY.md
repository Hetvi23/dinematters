# DineMatters FastAPI Proxy - Complete API Inventory

**Generated**: 2026-01-13
**Purpose**: Document ALL APIs used by frontend for FastAPI proxy implementation

---

## PART 1: API INVENTORY

### ✅ Custom Whitelisted APIs (Already SaaS-compliant)

These APIs are already properly structured and will be proxied AS-IS by FastAPI.

#### A. UI APIs (Used by Frontend Admin)

| # | Endpoint | Method | Type | Parameters | Frontend Usage |
|---|----------|--------|------|------------|----------------|
| 1 | `dinematters.dinematters.api.ui.get_doctype_meta` | POST | READ | `doctype` | `useDocTypeMeta` in `doctype.ts` |
| 2 | `dinematters.dinematters.api.ui.get_user_permissions` | POST | READ | `doctype` | `usePermissions` in `permissions.ts` |
| 3 | `dinematters.dinematters.api.ui.get_all_doctypes` | POST | READ | None | `Modules.tsx` |
| 4 | `dinematters.dinematters.api.ui.get_user_restaurants` | POST | READ | None | `Layout.tsx`, `SetupWizard.tsx` |
| 5 | `dinematters.dinematters.api.ui.get_restaurant_setup_progress` | POST | READ | `restaurant_id` | `SetupWizard.tsx` |
| 6 | `dinematters.dinematters.api.ui.get_setup_wizard_steps` | POST | READ | None | `SetupWizard.tsx` |

#### B. Order Management APIs

| # | Endpoint | Method | Type | Parameters | Frontend Usage |
|---|----------|--------|------|------------|----------------|
| 7 | `dinematters.dinematters.api.order_status.update_status` | POST | WRITE | `order_id`, `status` | `Orders.tsx`, `PastOrders.tsx`, `OrdersKanban.tsx` |
| 8 | `dinematters.dinematters.api.order_status.update_table_number` | POST | WRITE | `order_id`, `table_number` | `Orders.tsx`, `PastOrders.tsx`, `OrdersKanban.tsx`, `OrderDetail.tsx` |

#### C. Document Management APIs

| # | Endpoint | Method | Type | Parameters | Frontend Usage |
|---|----------|--------|------|------------|----------------|
| 9 | `dinematters.dinematters.api.documents.create_document` | POST | WRITE | `doctype`, `doc_data` | `DynamicForm.tsx` |
| 10 | `dinematters.dinematters.api.documents.update_document` | POST | WRITE | `doctype`, `name`, `doc_data` | `DynamicForm.tsx` |

#### D. Restaurant-Specific APIs

| # | Endpoint | Method | Type | Parameters | Frontend Usage |
|---|----------|--------|------|------------|----------------|
| 11 | `dinematters.dinematters.doctype.restaurant.restaurant.generate_qr_codes_pdf` | POST | WRITE | `restaurant` | `Layout.tsx`, `Dashboard.tsx`, `QRCodes.tsx` |
| 12 | `dinematters.dinematters.doctype.restaurant.restaurant.get_qr_codes_pdf_url` | POST | READ | `restaurant` | `Dashboard.tsx`, `QRCodes.tsx` |

#### E. Public SaaS APIs (From API_DOCUMENTATION.md)

These are already documented in API_DOCUMENTATION.md and NOT used by admin frontend but may be used by customer-facing app.

---

### ⚠️ FRAPPE RESOURCE APIs (NEED WRAPPERS)

These APIs directly expose Frappe's `/api/resource` endpoint and MUST be wrapped.

#### F. Frappe Client Methods (Need Wrappers)

| # | Endpoint | Method | Type | Parameters | Frontend Usage | Wrapper Status |
|---|----------|--------|------|------------|----------------|----------------|
| 13 | `frappe.client.get_list` | POST | READ | `doctype`, `filters`, `fields`, `limit_page_length`, `order_by` | `SetupWizard.tsx` | ❌ NEEDS WRAPPER |
| 14 | `frappe.client.get` | POST | READ | `doctype`, `name` | `SetupWizard.tsx` | ❌ NEEDS WRAPPER |
| 15 | `frappe.client.insert` | POST | WRITE | `doc` | `Layout.tsx`, `ProductNew.tsx` | ❌ NEEDS WRAPPER |
| 16 | `frappe.client.delete` | POST | WRITE | `doctype`, `name` | `ModuleList.tsx`, `ModuleDetail.tsx` | ❌ NEEDS WRAPPER |

#### G. Frappe React SDK Hooks (Direct Resource Access - Need Wrappers)

| # | Hook | Real Endpoint | Method | Type | Frontend Usage | Wrapper Status |
|---|------|---------------|--------|------|----------------|----------------|
| 17 | `useFrappeGetDocList` | `/api/resource/{doctype}` | GET | READ | `Orders.tsx`, `Products.tsx`, `Categories.tsx`, `Dashboard.tsx`, etc. | ❌ NEEDS WRAPPER |
| 18 | `useFrappeGetDoc` | `/api/resource/{doctype}/{name}` | GET | READ | `SetupWizard.tsx`, `Orders.tsx`, `Products.tsx`, etc. | ❌ NEEDS WRAPPER |
| 19 | `useFrappeUpdateDoc` | `/api/resource/{doctype}/{name}` | PUT | WRITE | `QRCodes.tsx` | ❌ NEEDS WRAPPER |
| 20 | `useFrappeDeleteDoc` | `/api/resource/{doctype}/{name}` | DELETE | WRITE | `Products.tsx`, `Categories.tsx` | ❌ NEEDS WRAPPER |

---

## PART 2: API CLASSIFICATION

### READ APIs (Cacheable)
- All UI APIs (1-6)
- `get_qr_codes_pdf_url` (12)
- `frappe.client.get_list` (13)
- `frappe.client.get` (14)
- `useFrappeGetDocList` (17)
- `useFrappeGetDoc` (18)

**Total READ APIs: 12**

### WRITE APIs (Never Cache)
- `update_status` (7)
- `update_table_number` (8)
- `create_document` (9)
- `update_document` (10)
- `generate_qr_codes_pdf` (11)
- `frappe.client.insert` (15)
- `frappe.client.delete` (16)
- `useFrappeUpdateDoc` (19)
- `useFrappeDeleteDoc` (20)

**Total WRITE APIs: 9**

### Custom Whitelisted APIs
- APIs 1-12 (already properly wrapped)

**Total: 12 APIs**

### Frappe Built-in / Resource APIs (Need Wrappers)
- APIs 13-20 (need custom wrappers)

**Total: 8 APIs**

---

## PART 3: WRAPPER REQUIREMENTS

### Critical Wrappers to Add in ERPNext

We must create wrapper methods in `dinematters/dinematters/api/documents.py` for these Frappe APIs:

```python
@frappe.whitelist()
def get_doc_list(doctype, filters=None, fields=None, limit_page_length=20, order_by=None):
    """Wrapper for frappe.client.get_list"""
    # Validate restaurant access
    # Call frappe.get_list with exact same parameters
    # Return in same format
    pass

@frappe.whitelist()
def get_doc(doctype, name):
    """Wrapper for frappe.client.get"""
    # Validate restaurant access
    # Call frappe.get_doc
    # Return in same format
    pass

@frappe.whitelist()
def insert_doc(doc):
    """Wrapper for frappe.client.insert"""
    # Validate restaurant access
    # Call frappe.get_doc(doc).insert()
    # Return in same format
    pass

@frappe.whitelist()
def delete_doc(doctype, name):
    """Wrapper for frappe.client.delete"""
    # Validate restaurant access
    # Call frappe.delete_doc
    # Return in same format
    pass

@frappe.whitelist()
def update_doc(doctype, name, doc_data):
    """Wrapper for resource API PUT"""
    # Already exists as update_document
    pass
```

For `useFrappeGetDocList` and `useFrappeGetDoc`, we'll map them to use these wrappers instead.

---

## PART 4: FASTAPI ROUTE MAPPING

FastAPI will create 1:1 routes for all 20 APIs:

### Group A: UI Routes
```
POST /api/method/dinematters.dinematters.api.ui.get_doctype_meta
POST /api/method/dinematters.dinematters.api.ui.get_user_permissions
POST /api/method/dinematters.dinematters.api.ui.get_all_doctypes
POST /api/method/dinematters.dinematters.api.ui.get_user_restaurants
POST /api/method/dinematters.dinematters.api.ui.get_restaurant_setup_progress
POST /api/method/dinematters.dinematters.api.ui.get_setup_wizard_steps
```

### Group B: Order Management Routes
```
POST /api/method/dinematters.dinematters.api.order_status.update_status
POST /api/method/dinematters.dinematters.api.order_status.update_table_number
```

### Group C: Document Management Routes
```
POST /api/method/dinematters.dinematters.api.documents.create_document
POST /api/method/dinematters.dinematters.api.documents.update_document
POST /api/method/dinematters.dinematters.api.documents.get_doc_list (NEW WRAPPER)
POST /api/method/dinematters.dinematters.api.documents.get_doc (NEW WRAPPER)
POST /api/method/dinematters.dinematters.api.documents.insert_doc (NEW WRAPPER)
POST /api/method/dinematters.dinematters.api.documents.delete_doc (NEW WRAPPER)
```

### Group D: Restaurant Routes
```
POST /api/method/dinematters.dinematters.doctype.restaurant.restaurant.generate_qr_codes_pdf
POST /api/method/dinematters.dinematters.doctype.restaurant.restaurant.get_qr_codes_pdf_url
```

### Group E: Frappe Built-in Routes (Map to wrappers)
```
POST /api/method/frappe.client.get_list → dinematters.dinematters.api.documents.get_doc_list
POST /api/method/frappe.client.get → dinematters.dinematters.api.documents.get_doc
POST /api/method/frappe.client.insert → dinematters.dinematters.api.documents.insert_doc
POST /api/method/frappe.client.delete → dinematters.dinematters.api.documents.delete_doc
```

### Group F: Resource API Routes (Map to wrappers)
```
GET /api/resource/{doctype} → dinematters.dinematters.api.documents.get_doc_list
GET /api/resource/{doctype}/{name} → dinematters.dinematters.api.documents.get_doc
PUT /api/resource/{doctype}/{name} → dinematters.dinematters.api.documents.update_document
DELETE /api/resource/{doctype}/{name} → dinematters.dinematters.api.documents.delete_doc
```

---

## PART 5: AUTHENTICATION STRATEGY

### ERPNext System User
- **Username**: `fastapi_system_user`
- **Role**: `System Manager` (or custom role with full access)
- **API Key + Secret**: Generated once, stored securely
- **Purpose**: All FastAPI → ERPNext calls use this user

### Frontend User Authentication
- FastAPI issues JWT tokens after login
- JWT contains: `user_id`, `email`, `restaurant_access`
- Every FastAPI request validates JWT
- FastAPI passes user context to ERPNext via API call parameters

---

## PART 6: RATE LIMITING RULES

### Per-User Limits
- READ APIs: 100 requests/minute
- WRITE APIs: 20 requests/minute

### Per-IP Limits
- Global: 1000 requests/minute
- Burst: 50 requests/second

### Priority Routes (No Limits)
- Health check
- Login/logout
- Static assets

---

## PART 7: CACHING STRATEGY

### ✅ CACHE (Short TTL: 30-60 seconds)
- `get_doctype_meta` (60s)
- `get_user_permissions` (30s)
- `get_all_doctypes` (300s - 5 minutes)
- `get_user_restaurants` (60s)
- `get_setup_wizard_steps` (300s)
- `get_qr_codes_pdf_url` (60s)

### ✅ CACHE (Medium TTL: 5-10 minutes)
- `useFrappeGetDocList` for Categories (600s)
- `useFrappeGetDocList` for Products (300s)

### ❌ NEVER CACHE
- All WRITE APIs
- `useFrappeGetDocList` for Orders
- `useFrappeGetDoc` for Orders
- `get_restaurant_setup_progress` (real-time status)
- Any API with user-specific data

---

## PART 8: VERIFICATION CHECKLIST

For each API, manually verify:

1. **Request Format**
   - [ ] Parameters match exactly
   - [ ] Parameter types match
   - [ ] Optional vs required params match

2. **Response Format**
   - [ ] Response structure identical
   - [ ] All keys present
   - [ ] All values have same types
   - [ ] Error responses match

3. **HTTP Status Codes**
   - [ ] Success: 200
   - [ ] Validation Error: 417 (Frappe standard)
   - [ ] Permission Error: 403
   - [ ] Not Found: 404

4. **Side Effects**
   - [ ] Database changes identical
   - [ ] File operations identical
   - [ ] Email/notifications identical

---

## SUMMARY

**Total APIs**: 20
- **Custom Whitelisted**: 12 (already OK)
- **Need Wrappers**: 8 (Frappe built-in/resource)

**Next Steps**:
1. ✅ Complete this inventory
2. ⏳ Create 4 wrapper methods in ERPNext
3. ⏳ Build FastAPI service with 20 routes
4. ⏳ Implement authentication
5. ⏳ Add rate limiting
6. ⏳ Add caching
7. ⏳ Manual verification

