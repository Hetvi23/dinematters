# FastAPI Proxy - Complete API URL List

**Base URL**: `http://127.0.0.1:9005` (or your server URL)

---

## 🔧 System Endpoints

### Health Check
- **GET** `/health`
  - Returns: `{"status": "healthy", "service": "dinematters-fastapi-proxy", "version": "1.0.0"}`
  - No authentication required

### Root
- **GET** `/`
  - Returns: Service info
  - No authentication required

---

## 📱 UI APIs (6 endpoints)

**Prefix**: `/api/method`

1. **POST** `/api/method/dinematters.dinematters.api.ui.get_doctype_meta`
   - Parameters: `{"doctype": "string"}`
   - Type: READ
   - Cache: Yes (60s)

2. **POST** `/api/method/dinematters.dinematters.api.ui.get_user_permissions`
   - Parameters: `{"doctype": "string"}`
   - Type: READ
   - Cache: Yes (30s)

3. **POST** `/api/method/dinematters.dinematters.api.ui.get_all_doctypes`
   - Parameters: `{}`
   - Type: READ
   - Cache: Yes (300s)

4. **POST** `/api/method/dinematters.dinematters.api.ui.get_user_restaurants`
   - Parameters: `{}`
   - Type: READ
   - Cache: Yes (60s)

5. **POST** `/api/method/dinematters.dinematters.api.ui.get_restaurant_setup_progress`
   - Parameters: `{"restaurant_id": "string"}`
   - Type: READ
   - Cache: No (real-time)

6. **POST** `/api/method/dinematters.dinematters.api.ui.get_setup_wizard_steps`
   - Parameters: `{}`
   - Type: READ
   - Cache: Yes (300s)
   - **Note**: Auth temporarily disabled for testing

---

## 📦 Order Management APIs (2 endpoints)

**Prefix**: `/api/method`

1. **POST** `/api/method/dinematters.dinematters.api.order_status.update_status`
   - Parameters: `{"order_id": "string", "status": "string"}`
   - Type: WRITE
   - Cache: No

2. **POST** `/api/method/dinematters.dinematters.api.order_status.update_table_number`
   - Parameters: `{"order_id": "string", "table_number": int | null}`
   - Type: WRITE
   - Cache: No

---

## 📄 Document Management APIs (6 endpoints)

**Prefix**: `/api/method`

1. **POST** `/api/method/dinematters.dinematters.api.documents.create_document`
   - Parameters: `{"doctype": "string", "doc_data": {}}`
   - Type: WRITE
   - Cache: No

2. **POST** `/api/method/dinematters.dinematters.api.documents.update_document`
   - Parameters: `{"doctype": "string", "name": "string", "doc_data": {}}`
   - Type: WRITE
   - Cache: No

3. **POST** `/api/method/dinematters.dinematters.api.documents.get_doc_list`
   - Parameters: `{"doctype": "string", "filters": {} | null, "fields": [] | null, "limit_page_length": int | null, "order_by": "string" | null}`
   - Type: READ
   - Cache: Yes (depends on doctype)

4. **POST** `/api/method/dinematters.dinematters.api.documents.get_doc`
   - Parameters: `{"doctype": "string", "name": "string"}`
   - Type: READ
   - Cache: No

5. **POST** `/api/method/dinematters.dinematters.api.documents.insert_doc`
   - Parameters: `{"doc": {}}`
   - Type: WRITE
   - Cache: No

6. **POST** `/api/method/dinematters.dinematters.api.documents.delete_doc`
   - Parameters: `{"doctype": "string", "name": "string"}`
   - Type: WRITE
   - Cache: No

---

## 🍽️ Restaurant APIs (2 endpoints)

**Prefix**: `/api/method`

1. **POST** `/api/method/dinematters.dinematters.doctype.restaurant.restaurant.generate_qr_codes_pdf`
   - Parameters: `{"restaurant": "string"}`
   - Type: WRITE
   - Cache: No

2. **POST** `/api/method/dinematters.dinematters.doctype.restaurant.restaurant.get_qr_codes_pdf_url`
   - Parameters: `{"restaurant": "string"}`
   - Type: READ
   - Cache: Yes (60s)

---

## 🔧 Frappe Client APIs (4 endpoints - Mapped to wrappers)

**Prefix**: `/api/method`

These map to `dinematters.dinematters.api.documents.*` wrapper methods:

1. **POST** `/api/method/frappe.client.get_list`
   - Maps to: `documents.get_doc_list`
   - Parameters: `{"doctype": "string", "filters": {} | null, "fields": [] | null, "limit_start": int | null, "limit_page_length": int | null, "order_by": "string" | null}`
   - Type: READ
   - Cache: Yes (depends on doctype)

2. **POST** `/api/method/frappe.client.get`
   - Maps to: `documents.get_doc`
   - Parameters: `{"doctype": "string", "name": "string", "fields": [] | null}`
   - Type: READ
   - Cache: No

3. **POST** `/api/method/frappe.client.insert`
   - Maps to: `documents.insert_doc`
   - Parameters: `{"doc": {}}`
   - Type: WRITE
   - Cache: No

4. **POST** `/api/method/frappe.client.delete`
   - Maps to: `documents.delete_doc`
   - Parameters: `{"doctype": "string", "name": "string"}`
   - Type: WRITE
   - Cache: No

---

## 🌐 Resource API (4 endpoints - RESTful style)

**Prefix**: `/api/resource`

These map to `dinematters.dinematters.api.documents.*` wrapper methods:

1. **GET** `/api/resource/{doctype}`
   - Maps to: `documents.get_doc_list`
   - Query Parameters: `?filters={json}&fields={json}&limit_page_length=int&order_by=string`
   - Type: READ
   - Cache: Yes (depends on doctype)
   - Example: `GET /api/resource/Restaurant?filters={"restaurant_id":"REST001"}`

2. **GET** `/api/resource/{doctype}/{name}`
   - Maps to: `documents.get_doc`
   - Type: READ
   - Cache: No
   - Example: `GET /api/resource/Restaurant/REST001`

3. **PUT** `/api/resource/{doctype}/{name}`
   - Maps to: `documents.update_document`
   - Body: `{"field1": "value1", "field2": "value2", ...}`
   - Type: WRITE
   - Cache: No
   - Example: `PUT /api/resource/Restaurant/REST001` with body `{"name": "New Name"}`

4. **DELETE** `/api/resource/{doctype}/{name}`
   - Maps to: `documents.delete_doc`
   - Type: WRITE
   - Cache: No
   - Example: `DELETE /api/resource/Restaurant/REST001`

---

## 📊 Summary

**Total Endpoints**: 28
- System: 2 (health, root)
- UI APIs: 6
- Order Management: 2
- Document Management: 6
- Restaurant: 2
- Frappe Client: 4
- Resource API: 4
- Catch-all (debug): 1

**Authentication**: 
- All endpoints require JWT token (except health, root, and temporarily `get_setup_wizard_steps`)
- Header: `Authorization: Bearer <jwt_token>`

**Rate Limiting**: 
- Not yet implemented (TODO)

**Caching**: 
- Not yet implemented (TODO)
- READ APIs marked for caching

---

## 🧪 Testing Examples

### Test Health Endpoint
```bash
curl http://127.0.0.1:9005/health
```

### Test UI Endpoint (no auth required temporarily)
```bash
curl -X POST http://127.0.0.1:9005/api/method/dinematters.dinematters.api.ui.get_setup_wizard_steps \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test with Authentication (when login is implemented)
```bash
curl -X POST http://127.0.0.1:9005/api/method/dinematters.dinematters.api.ui.get_doctype_meta \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"doctype": "Restaurant"}'
```

### Test Resource API
```bash
curl -X GET "http://127.0.0.1:9005/api/resource/Restaurant?limit_page_length=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📝 Notes

- All `/api/method/*` endpoints use POST method (ERPNext convention)
- All `/api/resource/*` endpoints use RESTful methods (GET, PUT, DELETE)
- All responses are identical to ERPNext responses (no transformation)
- All parameters match ERPNext exactly
- Error responses match ERPNext format
