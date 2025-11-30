# Backend API Documentation - ONO Menu System

## Table of Contents
1. [Product/Dish Data Structure](#productdish-data-structure)
2. [Cart Data Structure](#cart-data-structure)
3. [Customization System](#customization-system)
4. [Ordering Process](#ordering-process)
5. [API Endpoints Specification](#api-endpoints-specification)
6. [Data Flow Diagrams](#data-flow-diagrams)

---

## Product/Dish Data Structure

### Complete Dish Object Schema

```typescript
interface Dish {
  // Core Identification
  id: string                    // Unique identifier (e.g., "hot-coffee-espresso")
  name: string                  // Display name (e.g., "Espresso")
  category: string             // Category name (e.g., "Hot Coffee", "Bowls", "Desserts")
  type?: string                // Optional type for special sections (e.g., "top-picks", "chef-special")
  
  // Pricing
  price: number                // Current price (required)
  originalPrice?: number       // Original price before discount (optional, for showing discounts)
  
  // Media Content
  media?: string[]             // Array of media URLs: [image1, image2, video]
                               // Format: ["/path/to/image1.jpg", "/path/to/image2.jpg", "/path/to/video.mp4"]
                               // Maximum 3 items: 2 images + 1 video (or 3 images)
  hasNoMedia?: boolean        // Flag indicating product has no media content
  
  // Product Information
  description?: string         // Product description
  calories: number            // Calorie count (required)
  isVegetarian: boolean       // Dietary flag (true for vegetarian, false for non-vegetarian)
  estimatedTime?: number      // Estimated preparation time in minutes
  servingSize?: string | number // Serving size (e.g., "1", "1-2", "2-3")
  
  // Customization System
  customizationQuestions?: CustomizationQuestion[] // Array of customization questions
  
  // Additional Metadata (optional)
  mainCategory?: string       // Main category grouping (e.g., "beverages", "food")
}
```

### Example Dish Object

```json
{
  "id": "hot-coffee-espresso",
  "name": "Espresso",
  "price": 220,
  "originalPrice": 250,
  "category": "Hot Coffee",
  "description": "Single origin espresso with balanced sweetness, fruitiness and boldness",
  "isVegetarian": true,
  "calories": 5,
  "estimatedTime": 5,
  "servingSize": "1",
  "media": [
    "/images/food/grilled-chicken.jpg",
    "/images/food/chicken.jpg",
    "/videos/chicken.mp4"
  ],
  "mainCategory": "beverages",
  "customizationQuestions": [
    {
      "id": "add-ons",
      "title": "Add-ons",
      "subtitle": "Select as many as you want",
      "type": "multiple",
      "required": false,
      "options": [
        {
          "id": "extra-shot",
          "label": "Extra Espresso Shot",
          "price": 60,
          "isVegetarian": true
        },
        {
          "id": "sugar",
          "label": "Sugar",
          "price": 0,
          "isVegetarian": true
        }
      ]
    }
  ]
}
```

### Category Structure

```typescript
interface Category {
  id: string                  // Unique category ID (e.g., "hot-coffee", "bowls")
  name: string                // Category name (e.g., "Hot Coffee", "Bowls")
  displayName: string         // Display name for UI
  description: string          // Category description
  isSpecial?: boolean         // Flag for special categories
  productCount: number        // Number of products in this category (calculated)
  image?: string              // Category image URL (optional)
}
```

### Example Category Object

```json
{
  "id": "hot-coffee",
  "name": "Hot Coffee",
  "displayName": "Hot Coffee",
  "description": "Espresso-based coffee drinks",
  "isSpecial": false,
  "productCount": 12
}
```

---

## Cart Data Structure

### Cart Entry (Item with Customizations)

When a product has customizations, it's stored as a separate cart entry:

```typescript
interface CartItemEntry {
  entryId: string                    // Unique entry ID: "{dishId}-{timestamp}-{random}"
  dishId: string                    // Reference to dish ID
  quantity: number                   // Quantity for this specific customization combination
  customizations?: Record<string, string[]>  // Customization selections
                                      // Format: { "questionId": ["optionId1", "optionId2"] }
}
```

### Cart Storage Structure

The cart uses a dual storage system:

1. **Simple Items** (no customizations): Stored in `quantityCart` as `Record<string, number>`
   ```typescript
   {
     "dish-id-1": 2,  // 2 quantities of dish-id-1
     "dish-id-2": 1   // 1 quantity of dish-id-2
   }
   ```

2. **Items with Customizations**: Stored in `cartEntries` as `Map<string, CartItemEntry>`
   ```typescript
   {
     "entry-1": {
       entryId: "dish-id-1-1234567890-abc123",
       dishId: "dish-id-1",
       quantity: 1,
       customizations: {
         "add-ons": ["extra-shot", "sugar"],
         "milk": ["almond"]
       }
     }
   }
   ```

### Cart Context State

```typescript
interface CartContextType {
  // State
  cartItems: Record<string, number> | Set<string>  // Simple cart items
  cartItemsWithDetails: Map<string, CartItemEntry> // Items with customizations
  addingToCart: string | null                      // Currently adding item ID
  showSuccessAnimation: string | null             // Item showing success animation
  isFirstTimeCart: boolean                         // First time adding to cart flag
  cartMode: 'simple' | 'quantity'                 // Cart mode
  
  // Actions
  addToCart: (id: string, customizations?: Record<string, string[]>) => void
  addToCartWithEntry: (entryId: string, dishId: string, quantity: number, customizations?: Record<string, string[]>) => void
  removeFromCart: (id: string) => void
  removeEntryFromCart: (entryId: string) => void
  getCartQuantity: (id: string) => number
  getCartCustomizations: (id: string) => Record<string, string[]> | undefined
  getTotalCartItems: () => number
  isInCart: (id: string) => boolean
  clearCart: () => void
}
```

### Cart Item Calculation Logic

**Total Cart Items Count:**
- Count all entries from `cartEntries` (items with customizations)
- Count items from `quantityCart` that are NOT in `cartEntries`
- Sum both counts

**Price Calculation:**
```typescript
// Base price per unit
const basePrice = dish.price

// Customization price per unit
const customizationPrice = sum of all selected option prices

// Total price per unit
const unitPrice = basePrice + customizationPrice

// Total price for quantity
const totalPrice = unitPrice * quantity

// If discount exists
const discount = (originalPrice - price) * quantity
const finalPrice = totalPrice - discount
```

---

## Customization System

### Customization Question Structure

```typescript
interface CustomizationQuestion {
  id: string                    // Unique question ID (e.g., "add-ons", "milk", "size")
  title: string                 // Question title (e.g., "Add-ons", "Milk Type")
  subtitle?: string             // Subtitle/instruction (e.g., "Select as many as you want")
  type: 'single' | 'multiple' | 'checkbox'  // Selection type
  required: boolean             // Whether selection is required
  options: CustomizationOption[] // Available options
}

interface CustomizationOption {
  id: string                    // Unique option ID (e.g., "extra-shot", "almond")
  label: string                 // Display label (e.g., "Extra Espresso Shot", "Almond Milk")
  price: number                 // Additional price (0 for no extra charge)
  isDefault?: boolean           // Whether this is the default selection
  isVegetarian?: boolean        // Dietary flag for the option
}
```

### Customization Selection Format

When a user selects customizations, the format stored is:

```typescript
Record<string, string[]>
```

**Example:**
```json
{
  "add-ons": ["extra-shot", "sugar"],
  "milk": ["almond"],
  "size": ["large"]
}
```

**Key Rules:**
- Key = `questionId` from `CustomizationQuestion`
- Value = Array of selected `optionId`s from `CustomizationOption`
- For `type: 'single'`, array contains exactly 1 option ID
- For `type: 'multiple'`, array can contain multiple option IDs
- If `required: true` and no default, at least one option must be selected

### Customization Price Calculation

```typescript
function calculateCustomizationPrice(
  dish: Dish,
  customizations: Record<string, string[]>
): number {
  let totalPrice = 0
  
  if (!customizations || !dish.customizationQuestions) {
    return totalPrice
  }
  
  // Iterate through each customization question
  Object.entries(customizations).forEach(([questionId, selectedOptionIds]) => {
    // Find the question
    const question = dish.customizationQuestions.find(q => q.id === questionId)
    if (!question) return
    
    // For each selected option, add its price
    selectedOptionIds.forEach(optionId => {
      const option = question.options.find(opt => opt.id === optionId)
      if (option && typeof option.price === 'number') {
        totalPrice += option.price
      }
    })
  })
  
  return totalPrice
}
```

---

## Ordering Process

### Order Flow

1. **Cart Management** → User adds items to cart
2. **Cart Review** → User reviews cart items, customizations, and totals
3. **Swipe to Order** → User swipes to place order (UI interaction)
4. **Order Placement** → Cart items moved to "in-progress" state
5. **Order Processing** → Backend receives order and processes it
6. **Order Status** → Order status tracked and updated

### Order Data Structure

```typescript
interface Order {
  // Order Identification
  id: string                    // Unique order ID (generated by backend)
  orderNumber?: string          // Human-readable order number
  
  // Order Items
  items: OrderItem[]            // Array of ordered items
  
  // Customer Information
  customerInfo: {
    name?: string               // Customer name (optional)
    email?: string              // Customer email (optional)
    phone?: string              // Customer phone (optional)
    userId?: string             // User ID if logged in (optional)
  }
  
  // Order Details
  subtotal: number              // Subtotal before discounts
  discount: number               // Total discount amount
  tax: number                   // Tax amount (calculated by backend)
  deliveryFee: number            // Delivery fee (if applicable)
  total: number                 // Final total amount
  
  // Special Instructions
  cookingRequests?: string[]    // Array of cooking requests/instructions
  
  // Order Status
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  
  // Timestamps
  createdAt: Date               // Order creation timestamp
  updatedAt: Date               // Last update timestamp
  estimatedDelivery?: Date      // Estimated delivery time
  
  // Payment Information (if applicable)
  paymentInfo?: {
    method: 'card' | 'cash' | 'digital_wallet' | 'online'
    status: 'pending' | 'completed' | 'failed'
    transactionId?: string
  }
  
  // Delivery Information (if applicable)
  deliveryInfo?: {
    address?: string
    city?: string
    state?: string
    zipCode?: string
    instructions?: string
  }
}

interface OrderItem {
  dishId: string                // Reference to dish ID
  dish: Dish                    // Full dish object (for reference)
  quantity: number              // Quantity ordered
  customizations?: Record<string, string[]>  // Customization selections
  unitPrice: number             // Price per unit (base + customizations)
  totalPrice: number            // Total price for this item (unitPrice * quantity)
  originalPrice?: number        // Original price before discount (if applicable)
}
```

### Order Placement Payload

When placing an order, the frontend sends:

```typescript
interface OrderPlacementPayload {
  items: Array<{
    dishId: string
    quantity: number
    customizations?: Record<string, string[]>
  }>
  cookingRequests?: string[]    // Optional cooking instructions
  customerInfo?: {
    name?: string
    email?: string
    phone?: string
  }
  // Note: Pricing calculations can be done on backend or frontend
  // If frontend calculates, include:
  subtotal?: number
  discount?: number
  total?: number
}
```

### Example Order Placement Payload

```json
{
  "items": [
    {
      "dishId": "hot-coffee-espresso",
      "quantity": 2,
      "customizations": {
        "add-ons": ["extra-shot", "sugar"]
      }
    },
    {
      "dishId": "bowls-avocado-berry-salad",
      "quantity": 1,
      "customizations": {
        "dressing": ["balsamic"],
        "protein": ["chicken"]
      }
    }
  ],
  "cookingRequests": [
    "Less spicy",
    "No onion"
  ],
  "customerInfo": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

---

## API Endpoints Specification

### Base URL
```
https://your-backend-api.com/api/v1
```

### Authentication
All endpoints (except public ones) require authentication:
```
Authorization: Bearer {token}
```

---

### 1. Products/Dishes Endpoints

#### GET /products
Get all products/dishes

**Query Parameters:**
- `category` (optional): Filter by category name
- `type` (optional): Filter by type (e.g., "top-picks", "chef-special")
- `vegetarian` (optional): Filter by vegetarian (true/false)
- `search` (optional): Search query string
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

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
        "media": [
          "/images/food/grilled-chicken.jpg",
          "/images/food/chicken.jpg",
          "/videos/chicken.mp4"
        ],
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

#### GET /products/:productId
Get single product by ID

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "hot-coffee-espresso",
      "name": "Espresso",
      ...
    }
  }
}
```

#### GET /categories
Get all categories

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
        "productCount": 12
      }
    ]
  }
}
```

---

### 2. Cart Endpoints

#### POST /cart/add
Add item to cart

**Request Body:**
```json
{
  "dishId": "hot-coffee-espresso",
  "quantity": 1,
  "customizations": {
    "add-ons": ["extra-shot", "sugar"],
    "milk": ["almond"]
  }
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
        "add-ons": ["extra-shot", "sugar"],
        "milk": ["almond"]
      },
      "unitPrice": 310,
      "totalPrice": 310
    },
    "cart": {
      "totalItems": 3,
      "subtotal": 750,
      "discount": 50,
      "total": 700
    }
  }
}
```

#### GET /cart
Get current cart

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
          "add-ons": ["extra-shot", "sugar"]
        },
        "unitPrice": 310,
        "totalPrice": 310
      }
    ],
    "summary": {
      "subtotal": 750,
      "discount": 50,
      "tax": 0,
      "deliveryFee": 0,
      "total": 700
    }
  }
}
```

#### PATCH /cart/items/:entryId
Update cart item quantity

**Request Body:**
```json
{
  "quantity": 2
}
```

#### DELETE /cart/items/:entryId
Remove item from cart

**Response:**
```json
{
  "success": true,
  "message": "Item removed from cart"
}
```

#### DELETE /cart
Clear entire cart

**Response:**
```json
{
  "success": true,
  "message": "Cart cleared"
}
```

---

### 3. Order Endpoints

#### POST /orders
Place a new order

**Request Body:**
```json
{
  "items": [
    {
      "dishId": "hot-coffee-espresso",
      "quantity": 2,
      "customizations": {
        "add-ons": ["extra-shot", "sugar"]
      }
    }
  ],
  "cookingRequests": [
    "Less spicy",
    "No onion"
  ],
  "customerInfo": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "deliveryInfo": {
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "instructions": "Ring doorbell"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order-1234567890",
      "orderNumber": "ORD-2024-001",
      "items": [
        {
          "dishId": "hot-coffee-espresso",
          "dish": {
            "id": "hot-coffee-espresso",
            "name": "Espresso",
            ...
          },
          "quantity": 2,
          "customizations": {
            "add-ons": ["extra-shot", "sugar"]
          },
          "unitPrice": 310,
          "totalPrice": 620
        }
      ],
      "subtotal": 750,
      "discount": 50,
      "tax": 75,
      "deliveryFee": 0,
      "total": 775,
      "cookingRequests": ["Less spicy", "No onion"],
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00Z",
      "estimatedDelivery": "2024-01-15T11:00:00Z"
    }
  }
}
```

#### GET /orders
Get user's orders

**Query Parameters:**
- `status` (optional): Filter by status
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order-1234567890",
        "orderNumber": "ORD-2024-001",
        "status": "preparing",
        "total": 775,
        "createdAt": "2024-01-15T10:30:00Z",
        "estimatedDelivery": "2024-01-15T11:00:00Z"
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

#### GET /orders/:orderId
Get single order details

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order-1234567890",
      "orderNumber": "ORD-2024-001",
      "items": [...],
      "status": "preparing",
      "total": 775,
      "createdAt": "2024-01-15T10:30:00Z",
      "estimatedDelivery": "2024-01-15T11:00:00Z"
    }
  }
}
```

#### PATCH /orders/:orderId/status
Update order status (admin/backend only)

**Request Body:**
```json
{
  "status": "preparing"
}
```

---

## Data Flow Diagrams

### Add to Cart Flow

```
User Action
    ↓
Select Product
    ↓
Has Customizations?
    ├─ Yes → Open Customization Modal
    │         ↓
    │      Select Options
    │         ↓
    │      Confirm Customizations
    │         ↓
    └─ No → Direct Add
              ↓
    Create Cart Entry
    ├─ With Customizations → Store in cartEntries Map
    └─ Without Customizations → Store in quantityCart Record
              ↓
    Update Cart State
              ↓
    Save to LocalStorage (Frontend)
              ↓
    POST /cart/add (Backend API)
              ↓
    Backend Response
              ↓
    Update UI (Success Animation)
```

### Order Placement Flow

```
User Reviews Cart
    ↓
Swipe to Order (UI Interaction)
    ↓
Cart Items Prepared
    ├─ Items with Customizations → Include full customization data
    └─ Items without Customizations → Include only dishId and quantity
              ↓
    Calculate Totals
    ├─ Subtotal (sum of all item prices)
    ├─ Discount (if originalPrice > price)
    ├─ Tax (calculated by backend)
    └─ Total (subtotal - discount + tax)
              ↓
    POST /orders
    Request Body:
    {
      items: [...],
      cookingRequests: [...],
      customerInfo: {...}
    }
              ↓
    Backend Processing
    ├─ Validate items
    ├─ Calculate final pricing
    ├─ Create order record
    ├─ Generate order number
    └─ Set status to "pending"
              ↓
    Backend Response
    {
      order: {
        id: "...",
        orderNumber: "...",
        status: "pending",
        ...
      }
    }
              ↓
    Frontend Actions
    ├─ Move cart items to "in-progress"
    ├─ Clear cart
    ├─ Show success modal
    └─ Navigate to /in-progress page
              ↓
    Order Status Updates
    ├─ Backend updates status
    ├─ Frontend polls or receives webhook
    └─ UI updates accordingly
```

### Customization Flow

```
Product with Customizations
    ↓
User Clicks "Add" or "Customize"
    ↓
Open Customization Modal
    ↓
Display Customization Questions
    ├─ Single Selection (Radio)
    ├─ Multiple Selection (Checkbox)
    └─ Required vs Optional
              ↓
User Selects Options
    ├─ For Single: Replace previous selection
    └─ For Multiple: Toggle selection
              ↓
Calculate Price
    ├─ Base Price (from dish)
    ├─ Customization Price (sum of selected options)
    └─ Total Price = (Base + Customization) × Quantity
              ↓
User Confirms
    ↓
Create Customization Record
    {
      "questionId1": ["optionId1", "optionId2"],
      "questionId2": ["optionId3"]
    }
              ↓
Add to Cart with Customizations
    ↓
Store as Cart Entry
    {
      entryId: "unique-id",
      dishId: "product-id",
      quantity: 1,
      customizations: {...}
    }
```

---

## Important Notes for Backend Implementation

### 1. Price Calculation
- **Frontend calculates** prices for display purposes
- **Backend must validate and recalculate** all prices for security
- Never trust frontend price calculations for payment processing

### 2. Customization Validation
- Validate that all `required` customization questions have selections
- Validate that selected option IDs exist for each question
- Validate that `single` type questions have exactly 1 selection
- Validate that option prices match backend records

### 3. Cart Entry Uniqueness
- Items with **identical customizations** should increment quantity
- Items with **different customizations** should create separate entries
- Use `entryId` format: `{dishId}-{timestamp}-{random}`

### 4. Order Status Flow
```
pending → confirmed → preparing → ready → delivered
                ↓
            cancelled (can happen at any stage before delivered)
```

### 5. Media URLs
- Media URLs can be:
  - Relative paths: `/images/food/chicken.jpg`
  - Absolute URLs: `https://cdn.example.com/images/chicken.jpg`
- Backend should validate media URLs exist
- Consider CDN for media delivery

### 6. LocalStorage vs Backend Sync
- Frontend uses LocalStorage for offline cart persistence
- Backend API should sync cart state when user is authenticated
- Consider implementing cart sync endpoint: `POST /cart/sync`

### 7. Error Handling
All API responses should follow this format:

**Success:**
```json
{
  "success": true,
  "data": {...}
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {...}
  }
}
```

### 8. Common Error Codes
- `PRODUCT_NOT_FOUND`: Product ID doesn't exist
- `INVALID_CUSTOMIZATION`: Customization selection is invalid
- `CART_ITEM_NOT_FOUND`: Cart item/entry doesn't exist
- `ORDER_NOT_FOUND`: Order ID doesn't exist
- `INVALID_PRICE`: Price mismatch or invalid
- `INSUFFICIENT_STOCK`: Product out of stock
- `UNAUTHORIZED`: Authentication required
- `VALIDATION_ERROR`: Request validation failed

---

## Database Schema Recommendations

### Products Table
```sql
CREATE TABLE products (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  category VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  description TEXT,
  calories INT NOT NULL,
  is_vegetarian BOOLEAN NOT NULL,
  estimated_time INT,
  serving_size VARCHAR(50),
  has_no_media BOOLEAN DEFAULT FALSE,
  main_category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Product Media Table
```sql
CREATE TABLE product_media (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id VARCHAR(255) NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_type ENUM('image', 'video') NOT NULL,
  display_order INT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

### Customization Questions Table
```sql
CREATE TABLE customization_questions (
  id VARCHAR(255) PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  type ENUM('single', 'multiple', 'checkbox') NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  display_order INT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

### Customization Options Table
```sql
CREATE TABLE customization_options (
  id VARCHAR(255) PRIMARY KEY,
  question_id VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  is_vegetarian BOOLEAN,
  display_order INT NOT NULL,
  FOREIGN KEY (question_id) REFERENCES customization_questions(id) ON DELETE CASCADE
);
```

### Cart Entries Table
```sql
CREATE TABLE cart_entries (
  entry_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255), -- NULL for guest users
  session_id VARCHAR(255), -- For guest cart tracking
  product_id VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  customizations JSON, -- Store as JSON
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### Orders Table
```sql
CREATE TABLE orders (
  id VARCHAR(255) PRIMARY KEY,
  order_number VARCHAR(100) UNIQUE NOT NULL,
  user_id VARCHAR(255),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  cooking_requests JSON,
  status ENUM('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled') DEFAULT 'pending',
  payment_method ENUM('card', 'cash', 'digital_wallet', 'online'),
  payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  delivery_address TEXT,
  delivery_city VARCHAR(100),
  delivery_state VARCHAR(100),
  delivery_zip_code VARCHAR(20),
  delivery_instructions TEXT,
  estimated_delivery TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Order Items Table
```sql
CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  customizations JSON,
  unit_price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## Testing Checklist

### Product Endpoints
- [ ] GET /products returns all products
- [ ] GET /products with category filter works
- [ ] GET /products with search query works
- [ ] GET /products/:productId returns single product
- [ ] GET /products/:productId with invalid ID returns 404
- [ ] GET /categories returns all categories

### Cart Endpoints
- [ ] POST /cart/add adds item without customizations
- [ ] POST /cart/add adds item with customizations
- [ ] POST /cart/add increments quantity for identical items
- [ ] POST /cart/add creates new entry for different customizations
- [ ] GET /cart returns current cart
- [ ] PATCH /cart/items/:entryId updates quantity
- [ ] DELETE /cart/items/:entryId removes item
- [ ] DELETE /cart clears entire cart
- [ ] Cart calculations are correct (subtotal, discount, total)

### Order Endpoints
- [ ] POST /orders creates new order
- [ ] POST /orders validates all items exist
- [ ] POST /orders validates customizations
- [ ] POST /orders calculates correct totals
- [ ] GET /orders returns user's orders
- [ ] GET /orders/:orderId returns order details
- [ ] PATCH /orders/:orderId/status updates status
- [ ] Order status transitions are valid

### Edge Cases
- [ ] Product with no media (hasNoMedia: true)
- [ ] Product with discount (originalPrice > price)
- [ ] Multiple customization questions
- [ ] Required vs optional customizations
- [ ] Empty cart handling
- [ ] Invalid product IDs
- [ ] Invalid customization selections
- [ ] Large quantities
- [ ] Concurrent cart updates

---

## Version History

- **v1.0.0** (2024-01-15): Initial documentation
  - Product/Dish data structure
  - Cart data structure
  - Customization system
  - Ordering process
  - API endpoints specification
  - Database schema recommendations

---

## Support & Contact

For questions or clarifications about this API documentation, please contact the development team.

**Last Updated:** January 15, 2024

