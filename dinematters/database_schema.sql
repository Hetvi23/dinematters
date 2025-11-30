-- =====================================================
-- Database Schema for ONO Menu System Backend
-- =====================================================
-- ⚠️ IMPORTANT: This SQL schema is for REFERENCE ONLY
-- 
-- Since you're using ERPNext/Frappe, you should create DOC TYPES
-- (not raw SQL tables). ERPNext automatically creates database tables
-- from DocType definitions.
--
-- See: ERPNext_DOCTYPE_STRUCTURE.md for the correct implementation
--
-- This SQL file shows the underlying database structure that will be
-- created automatically when you create the DocTypes in ERPNext.
-- =====================================================
-- This schema supports storing menu items, photos, customizations,
-- cart entries, and orders from the frontend API
-- =====================================================

-- =====================================================
-- 1. CATEGORIES TABLE
-- =====================================================
-- Stores menu categories (Hot Coffee, Bowls, Desserts, etc.)
CREATE TABLE categories (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_special BOOLEAN DEFAULT FALSE,
  image VARCHAR(500), -- Category image URL
  display_order INT DEFAULT 0, -- For sorting categories
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_display_order (display_order),
  INDEX idx_is_special (is_special)
);

-- =====================================================
-- 2. PRODUCTS TABLE
-- =====================================================
-- Stores all menu items/dishes
CREATE TABLE products (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2), -- For discount display
  category VARCHAR(100) NOT NULL, -- References category name
  category_id VARCHAR(255), -- References category.id (optional, for better normalization)
  type VARCHAR(50), -- Optional type (e.g., "top-picks", "chef-special")
  description TEXT,
  calories INT NOT NULL,
  is_vegetarian BOOLEAN NOT NULL,
  estimated_time INT, -- Estimated preparation time in minutes
  serving_size VARCHAR(50), -- e.g., "1", "1-2", "2-3"
  has_no_media BOOLEAN DEFAULT FALSE, -- Flag if product has no media
  main_category VARCHAR(100), -- Main category grouping (e.g., "beverages", "food")
  is_active BOOLEAN DEFAULT TRUE, -- For soft delete/hiding products
  display_order INT DEFAULT 0, -- For sorting within category
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_category_id (category_id),
  INDEX idx_type (type),
  INDEX idx_is_vegetarian (is_vegetarian),
  INDEX idx_is_active (is_active),
  INDEX idx_main_category (main_category),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- =====================================================
-- 3. PRODUCT_MEDIA TABLE
-- =====================================================
-- Stores product images and videos
-- Supports up to 3 media items per product (2 images + 1 video or 3 images)
CREATE TABLE product_media (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id VARCHAR(255) NOT NULL,
  media_url VARCHAR(500) NOT NULL, -- URL or path to media file
  media_type ENUM('image', 'video') NOT NULL,
  display_order INT NOT NULL DEFAULT 0, -- Order of display (0, 1, 2)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_display_order (product_id, display_order),
  UNIQUE KEY unique_product_media_order (product_id, display_order)
);

-- =====================================================
-- 4. CUSTOMIZATION_QUESTIONS TABLE
-- =====================================================
-- Stores customization questions for products
-- (e.g., "Add-ons", "Milk Type", "Size")
CREATE TABLE customization_questions (
  id VARCHAR(255) PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255), -- e.g., "Select as many as you want"
  type ENUM('single', 'multiple', 'checkbox') NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id),
  INDEX idx_display_order (display_order)
);

-- =====================================================
-- 5. CUSTOMIZATION_OPTIONS TABLE
-- =====================================================
-- Stores options for each customization question
-- (e.g., "Extra Espresso Shot", "Almond Milk", "Large")
CREATE TABLE customization_options (
  id VARCHAR(255) PRIMARY KEY,
  question_id VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) DEFAULT 0, -- Additional price (0 for no extra charge)
  is_default BOOLEAN DEFAULT FALSE, -- Whether this is the default selection
  is_vegetarian BOOLEAN, -- Dietary flag for the option
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES customization_questions(id) ON DELETE CASCADE,
  INDEX idx_question_id (question_id),
  INDEX idx_display_order (display_order)
);

-- =====================================================
-- 6. CART_ENTRIES TABLE
-- =====================================================
-- Stores cart items (both with and without customizations)
-- Supports guest users (session_id) and authenticated users (user_id)
CREATE TABLE cart_entries (
  entry_id VARCHAR(255) PRIMARY KEY, -- Format: "{dishId}-{timestamp}-{random}"
  user_id VARCHAR(255), -- NULL for guest users
  session_id VARCHAR(255), -- For guest cart tracking
  product_id VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  customizations JSON, -- Store as JSON: { "questionId": ["optionId1", "optionId2"] }
  unit_price DECIMAL(10, 2) NOT NULL, -- Price per unit (base + customizations)
  total_price DECIMAL(10, 2) NOT NULL, -- Total price (unit_price * quantity)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_product_id (product_id)
);

-- =====================================================
-- 7. ORDERS TABLE
-- =====================================================
-- Stores order information
CREATE TABLE orders (
  id VARCHAR(255) PRIMARY KEY, -- Unique order ID (generated by backend)
  order_number VARCHAR(100) UNIQUE NOT NULL, -- Human-readable order number (e.g., "ORD-2024-001")
  user_id VARCHAR(255), -- User ID if logged in (optional)
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  subtotal DECIMAL(10, 2) NOT NULL, -- Subtotal before discounts
  discount DECIMAL(10, 2) DEFAULT 0, -- Total discount amount
  tax DECIMAL(10, 2) DEFAULT 0, -- Tax amount (calculated by backend)
  delivery_fee DECIMAL(10, 2) DEFAULT 0, -- Delivery fee (if applicable)
  total DECIMAL(10, 2) NOT NULL, -- Final total amount
  cooking_requests JSON, -- Array of cooking requests/instructions
  status ENUM('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled') DEFAULT 'pending',
  payment_method ENUM('card', 'cash', 'digital_wallet', 'online'),
  payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  transaction_id VARCHAR(255), -- Payment transaction ID
  delivery_address TEXT,
  delivery_city VARCHAR(100),
  delivery_state VARCHAR(100),
  delivery_zip_code VARCHAR(20),
  delivery_instructions TEXT,
  estimated_delivery TIMESTAMP, -- Estimated delivery time
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_order_number (order_number),
  INDEX idx_created_at (created_at)
);

-- =====================================================
-- 8. ORDER_ITEMS TABLE
-- =====================================================
-- Stores individual items within an order
CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  customizations JSON, -- Customization selections: { "questionId": ["optionId1", "optionId2"] }
  unit_price DECIMAL(10, 2) NOT NULL, -- Price per unit (base + customizations)
  original_price DECIMAL(10, 2), -- Original price before discount (if applicable)
  total_price DECIMAL(10, 2) NOT NULL, -- Total price for this item (unitPrice * quantity)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_order_id (order_id),
  INDEX idx_product_id (product_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
-- Additional composite indexes for common query patterns

-- Products by category and active status
CREATE INDEX idx_products_category_active ON products(category, is_active);

-- Products by main category and type
CREATE INDEX idx_products_main_type ON products(main_category, type, is_active);

-- Cart entries by user/session and product
CREATE INDEX idx_cart_user_product ON cart_entries(user_id, product_id);
CREATE INDEX idx_cart_session_product ON cart_entries(session_id, product_id);

-- Orders by user and status
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- =====================================================
-- NOTES FOR IMPLEMENTATION
-- =====================================================
-- 
-- 1. MEDIA STORAGE:
--    - Media URLs can be relative paths: "/images/food/chicken.jpg"
--    - Or absolute URLs: "https://cdn.example.com/images/chicken.jpg"
--    - Backend should validate media URLs exist
--    - Consider CDN for media delivery
--    - Maximum 3 media items per product (enforced by application logic)
--
-- 2. CUSTOMIZATIONS:
--    - Stored as JSON in both cart_entries and order_items
--    - Format: { "questionId": ["optionId1", "optionId2"] }
--    - Backend must validate customization selections
--
-- 3. PRICING:
--    - Frontend calculates prices for display
--    - Backend MUST validate and recalculate all prices for security
--    - Never trust frontend price calculations for payment processing
--
-- 4. CATEGORIES:
--    - productCount is calculated dynamically (not stored)
--    - Can be computed: SELECT COUNT(*) FROM products WHERE category_id = ?
--
-- 5. CART ENTRIES:
--    - Items with identical customizations should increment quantity
--    - Items with different customizations create separate entries
--    - entryId format: "{dishId}-{timestamp}-{random}"
--
-- 6. ORDER STATUS FLOW:
--    pending → confirmed → preparing → ready → delivered
--    (cancelled can happen at any stage before delivered)
--
-- =====================================================

