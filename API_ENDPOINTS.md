# Dinematters API Endpoints

## Base URL
```
http://192.168.29.183:8000/
```

## Authentication
Most endpoints require authentication via Frappe session. Public endpoints (marked with `allow_guest=True`) can be accessed without authentication.

---

## 1. Categories API

### 1.1 Get All Categories
**Method:** `GET`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.categories.get_categories`  
**Authentication:** Not required (Public)  
**Description:** Get all menu categories with product counts

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "hot-coffee",
        "name": "Hot Coffee",
        "displayName": "Hot Coffee",
        "description": "Espresso-based coffee drinks",
        "isSpecial": false,
        "productCount": 12,
        "image": "http://192.168.29.183:8000/files/category-image.jpg"
      }
    ]
  }
}
```

---

## 2. Products API

### 2.1 Get All Products
**Method:** `GET`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.products.get_products`  
**Authentication:** Not required (Public)  
**Description:** Get all products/dishes with filters and pagination

**Query Parameters:**
- `category` (optional): Filter by category name
- `type` (optional): Filter by type (e.g., "top-picks", "chef-special")
- `vegetarian` (optional): Filter by vegetarian (true/false)
- `search` (optional): Search query string
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Example:**
```
http://192.168.29.183:8000/api/method/dinematters.dinematters.api.products.get_products?category=Hot Coffee&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "hot-coffee-espresso",
        "name": "Espresso",
        "price": 220,
        "originalPrice": 250,
        "category": "Hot Coffee",
        "description": "Single origin espresso...",
        "isVegetarian": true,
        "calories": 5,
        "estimatedTime": 5,
        "servingSize": "1",
        "media": ["/files/image1.jpg"],
        "customizationQuestions": [...]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "totalPages": 3
    }
  }
}
```

### 2.2 Get Single Product
**Method:** `GET`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.products.get_product`  
**Authentication:** Not required (Public)  
**Description:** Get single product by ID

**Query Parameters:**
- `product_id` (required): Product ID

**Example:**
```
http://192.168.29.183:8000/api/method/dinematters.dinematters.api.products.get_product?product_id=hot-coffee-espresso
```

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "hot-coffee-espresso",
      "name": "Espresso",
      "price": 220,
      "category": "Hot Coffee",
      ...
    }
  }
}
```

---

## 3. Cart API

### 3.1 Add Item to Cart
**Method:** `POST`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.cart.add_to_cart`  
**Authentication:** Required  
**Description:** Add item to cart

**Request Body (Form Data or JSON):**
```json
{
  "dish_id": "hot-coffee-espresso",
  "quantity": 1,
  "customizations": "{\"add-ons\": [\"extra-shot\", \"sugar\"]}",
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cartItem": {
      "entryId": "hot-coffee-espresso-1234567890-abc123",
      "dishId": "hot-coffee-espresso",
      "quantity": 1,
      "customizations": {
        "add-ons": ["extra-shot", "sugar"]
      },
      "unitPrice": 310,
      "totalPrice": 310
    },
    "cart": {
      "totalItems": 3,
      "subtotal": 750,
      "discount": 0,
      "tax": 0,
      "deliveryFee": 0,
      "total": 750
    }
  }
}
```

### 3.2 Get Cart
**Method:** `GET`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.cart.get_cart`  
**Authentication:** Required  
**Description:** Get current cart items and summary

**Query Parameters:**
- `session_id` (optional): Session ID for guest users

**Example:**
```
http://192.168.29.183:8000/api/method/dinematters.dinematters.api.cart.get_cart?session_id=test-session-123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "entryId": "hot-coffee-espresso-1234567890-abc123",
        "dishId": "hot-coffee-espresso",
        "dish": {
          "id": "hot-coffee-espresso",
          "name": "Espresso",
          "price": 220,
          ...
        },
        "quantity": 1,
        "customizations": {
          "add-ons": ["extra-shot"]
        },
        "unitPrice": 310,
        "totalPrice": 310
      }
    ],
    "summary": {
      "totalItems": 1,
      "subtotal": 310,
      "discount": 0,
      "tax": 0,
      "deliveryFee": 0,
      "total": 310
    }
  }
}
```

### 3.3 Update Cart Item
**Method:** `POST`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.cart.update_cart_item`  
**Authentication:** Required  
**Description:** Update cart item quantity

**Request Body:**
```json
{
  "entry_id": "hot-coffee-espresso-1234567890-abc123",
  "quantity": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cart item updated"
}
```

### 3.4 Remove Cart Item
**Method:** `POST`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.cart.remove_cart_item`  
**Authentication:** Required  
**Description:** Remove item from cart

**Request Body:**
```json
{
  "entry_id": "hot-coffee-espresso-1234567890-abc123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item removed from cart"
}
```

### 3.5 Clear Cart
**Method:** `POST`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.cart.clear_cart`  
**Authentication:** Required  
**Description:** Clear entire cart

**Request Body (optional):**
```json
{
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cart cleared"
}
```

---

## 4. Orders API

### 4.1 Create Order
**Method:** `POST`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.orders.create_order`  
**Authentication:** Required  
**Description:** Place a new order

**Request Body:**
```json
{
  "items": "[{\"dishId\": \"hot-coffee-espresso\", \"quantity\": 2, \"customizations\": {\"add-ons\": [\"extra-shot\"]}}]",
  "cooking_requests": "[]",
  "customer_info": "{\"name\": \"John Doe\", \"email\": \"john@example.com\", \"phone\": \"+1234567890\"}",
  "delivery_info": "{\"address\": \"123 Main St\", \"city\": \"City\", \"state\": \"State\", \"zipCode\": \"12345\"}",
  "session_id": "optional-session-id"
}
```

**Note:** In Frappe, complex objects need to be JSON stringified when sent as form data.

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order-1234567890-abc123",
      "orderNumber": "ORD-2024-001",
      "items": [
        {
          "dishId": "hot-coffee-espresso",
          "dish": {...},
          "quantity": 2,
          "customizations": {
            "add-ons": ["extra-shot"]
          },
          "unitPrice": 310,
          "totalPrice": 620
        }
      ],
      "subtotal": 620,
      "discount": 0,
      "tax": 0,
      "deliveryFee": 0,
      "total": 620,
      "cookingRequests": [],
      "status": "pending",
      "createdAt": "2024-01-01 12:00:00",
      "estimatedDelivery": "2024-01-01 12:30:00",
      "customerInfo": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890"
      },
      "deliveryInfo": {
        "address": "123 Main St",
        "city": "City",
        "state": "State",
        "zipCode": "12345"
      }
    }
  }
}
```

### 4.2 Get Orders
**Method:** `GET`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.orders.get_orders`  
**Authentication:** Required  
**Description:** Get user's orders with pagination

**Query Parameters:**
- `status` (optional): Filter by status (pending, confirmed, preparing, ready, delivered, cancelled)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `session_id` (optional): Session ID for guest users

**Example:**
```
http://192.168.29.183:8000/api/method/dinematters.dinematters.api.orders.get_orders?status=pending&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order-1234567890-abc123",
        "orderNumber": "ORD-2024-001",
        "status": "pending",
        "total": 620,
        "createdAt": "2024-01-01 12:00:00",
        "estimatedDelivery": "2024-01-01 12:30:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### 4.3 Get Single Order
**Method:** `GET`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.orders.get_order`  
**Authentication:** Required  
**Description:** Get single order details

**Query Parameters:**
- `order_id` (required): Order ID

**Example:**
```
http://192.168.29.183:8000/api/method/dinematters.dinematters.api.orders.get_order?order_id=order-1234567890-abc123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order-1234567890-abc123",
      "orderNumber": "ORD-2024-001",
      "items": [...],
      "subtotal": 620,
      "total": 620,
      "status": "pending",
      ...
    }
  }
}
```

### 4.4 Update Order Status
**Method:** `POST`  
**URL:** `http://192.168.29.183:8000/api/method/dinematters.dinematters.api.orders.update_order_status`  
**Authentication:** Required (Admin/Backend)  
**Description:** Update order status

**Request Body:**
```json
{
  "order_id": "order-1234567890-abc123",
  "status": "confirmed"
}
```

**Valid Status Values:**
- `pending`
- `confirmed`
- `preparing`
- `ready`
- `delivered`
- `cancelled`

**Response:**
```json
{
  "success": true,
  "message": "Order status updated",
  "data": {
    "order": {
      "id": "order-1234567890-abc123",
      "status": "confirmed",
      ...
    }
  }
}
```

---

## API Summary

| # | Method | Endpoint | Authentication | Description |
|---|--------|----------|----------------|-------------|
| 1 | GET | `/api/method/dinematters.dinematters.api.categories.get_categories` | Public | Get all categories |
| 2 | GET | `/api/method/dinematters.dinematters.api.products.get_products` | Public | Get all products |
| 3 | GET | `/api/method/dinematters.dinematters.api.products.get_product` | Public | Get single product |
| 4 | POST | `/api/method/dinematters.dinematters.api.cart.add_to_cart` | Required | Add item to cart |
| 5 | GET | `/api/method/dinematters.dinematters.api.cart.get_cart` | Required | Get cart |
| 6 | POST | `/api/method/dinematters.dinematters.api.cart.update_cart_item` | Required | Update cart item |
| 7 | POST | `/api/method/dinematters.dinematters.api.cart.remove_cart_item` | Required | Remove cart item |
| 8 | POST | `/api/method/dinematters.dinematters.api.cart.clear_cart` | Required | Clear cart |
| 9 | POST | `/api/method/dinematters.dinematters.api.orders.create_order` | Required | Create order |
| 10 | GET | `/api/method/dinematters.dinematters.api.orders.get_orders` | Required | Get orders |
| 11 | GET | `/api/method/dinematters.dinematters.api.orders.get_order` | Required | Get single order |
| 12 | POST | `/api/method/dinematters.dinematters.api.orders.update_order_status` | Required | Update order status |

---

## Notes

1. **Authentication:** For endpoints requiring authentication, you need to include Frappe session cookies or use API key/token authentication.

2. **JSON Stringification:** When sending complex objects (like arrays or nested objects) via form data in Frappe, they need to be JSON stringified. For example:
   ```json
   {
     "items": "[{\"dishId\": \"product-id\", \"quantity\": 1}]"
   }
   ```

3. **Session ID:** For guest users, you can use `session_id` parameter to maintain cart and order state across requests.

4. **Error Responses:** All APIs return error responses in the following format:
   ```json
   {
     "success": false,
     "error": {
       "code": "ERROR_CODE",
       "message": "Error message"
     }
   }
   ```

5. **Testing:** All 12 APIs have been tested and are working correctly. You can run the test suite using:
   ```bash
   bench --site dine_matters execute dinematters.dinematters.api.test_apis.run_all_tests
   ```

---

## Example cURL Requests

### Get Categories (Public)
```bash
curl -X GET "http://192.168.29.183:8000/api/method/dinematters.dinematters.api.categories.get_categories"
```

### Get Products (Public)
```bash
curl -X GET "http://192.168.29.183:8000/api/method/dinematters.dinematters.api.products.get_products?category=Hot Coffee&limit=10"
```

### Add to Cart (Requires Authentication)
```bash
curl -X POST "http://192.168.29.183:8000/api/method/dinematters.dinematters.api.cart.add_to_cart" \
  -H "Content-Type: application/json" \
  -d '{
    "dish_id": "hot-coffee-espresso",
    "quantity": 1,
    "customizations": "{}"
  }' \
  --cookie "sid=your-session-id"
```

---

**Last Updated:** 2024  
**API Version:** v1  
**App:** Dinematters

