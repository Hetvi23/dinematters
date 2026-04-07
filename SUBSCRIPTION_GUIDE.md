# 💎 DineMatters 3-Tier Subscription Architecture

Welcome to the definitive guide for the **DineMatters Lifecycle Journey**. This document outlines the technical and business logic for our 3-tier subscription model: **SILVER**, **GOLD**, and **DIAMOND**.

---

## 🚀 The Subscription Matrix

| Feature Category | Feature | 🆓 SILVER | 👑 GOLD | 💎 DIAMOND |
| :--- | :--- | :---: | :---: | :---: |
| **Pricing** | Monthly Cost | **Free** | **₹999** | **₹1299 (Min)** |
| | Commission Rate | 0% | 0% | **1.5%** |
| **Branding** | QR Code Logo | Watermarked | Custom Logo | Custom Logo |
| | Landing Page | Standard | Premium | White-labeled (Subtle) |
| **Content** | Menu Items | Unlimited | Unlimited | Unlimited |
| | Photo Uploads | Max 20 (Comp) | Unlimited (HQ) | Unlimited (HQ) |
| | Video Support | ❌ | ✅ | ✅ |
| **Intelligence**| AI Recommendations| ❌ | ✅ | ✅ |
| | Analytics Dashboard| ❌ | ✅ | ✅ |
| **Operations** | Online Ordering | ❌ | ✅ (WhatsApp) | ✅ (Full) |
| | Payments Integration| ❌ | ❌ | ✅ |
| | POS Integration | ❌ | ❌ | ✅ |
| **Engagement** | Loyalty & CRM | ❌ | ❌ | ✅ |
| | Coupons & Discounts | ❌ | ✅ (Basic) | ✅ (Full) |
| | Gamification | ❌ | ✅ | ✅ |
| **Support** | Priority Level | Basic | Priority | Dedicated Manager |

---

## 🏛️ Technical Tier Definitions

### 1️⃣ **DineMatters SILVER (Digital Visibility)**
> *"Get online in minutes. No cost, no strings."*

- **Purpose**: High-volume acquisition engine. Converts "Menu Only" restaurants.
- **Key Constraints**:
  - Gated ordering and AI features.
  - Mandatory "Powered by DineMatters" watermark on the central QR code area.
  - Image limit of 20 photos is enforced to optimize infrastructure cost.

### 2️⃣ **DineMatters GOLD (Digital Power)**
> *"Premium branding and AI insights for serious restaurants."*

- **Purpose**: Upsell tier for restaurants that want "Digital Presence" parity and WhatsApp ordering.
- **Key Enhancements**:
  - **WhatsApp Ordering**: Direct customer-to-restaurant order routing.
  - **AI Upselling**: Intelligent cross-selling during menu browsing.
  - **Video Menu**: Support for high-definition dish videos.
  - **Analytics Dashboard**: Insights on menu performance.
  - **Table/Banquet Booking**: Direct lead generation.
  - **Gamification**: Engagement tools like Spin-the-Wheel & Scratch Cards.
  - **Priority Email Support**.

### 3️⃣ **DineMatters DIAMOND (Full Sales Automation)**
> *"Complete transactional engine. Your sales, automated."*

- **Purpose**: Ultimate production tier. Handles the entire order-to-payment-to-POS lifecycle.
- **Key Enhancements**:
  - **Full Online Ordering**: Fully integrated checkout with multiple payment options.
  - **Loyalty Engine**: Automated customer retention via points and rewards.
  - **POS Sync**: Bi-directional integration with Petpooja and other partners.
  - **Data Mastery**: Full CRM exports and detailed financial reporting.

---

## ⚙️ Backend Implementation

### Feature Gating System
We use a centralized **Feature Gate** system to enforce tier restrictions across the codebase.

#### 1. The `@require_plan` Decorator
Restricts individual Python API endpoints to specific plans.
```python
# Location: dinematters/dinematters/utils/feature_gate.py

@frappe.whitelist()
@require_plan('DIAMOND')
def create_customer_order(restaurant_id, items):
    """Only DIAMOND restaurants can accept full online orders"""
    return process_order(restaurant_id, items)
```

#### 2. Feature-to-Plan Mapping
Centrally managed mapping of feature keys to allowed tiers.
```python
FEATURE_PLAN_MAP = {
    'ordering': ['GOLD', 'DIAMOND'],
    'pos_integration': ['DIAMOND'],
    'ai_recommendations': ['GOLD', 'DIAMOND'],
    'analytics': ['GOLD', 'DIAMOND'],
}
```

### 🧠 Billing Engine (Nightly Tasks)
The billing engine runs via **Frappe Scheduled Tasks** to handle charges in **DineMatters Coins** (1 Coin = ₹1).

#### **Daily Floor Recovery (23:59)**
For **GOLD** and **DIAMOND** tiers, the system ensures a minimum daily platform revenue.
- **GOLD**: Flat ₹33.30 daily subscription fee (₹999 / 30 days).
- **DIAMOND**: Minimum ₹43.30 daily floor (₹1299 / 30 days). Deducts `max(0, 43.30 - commissions_paid_today)`.

#### **Deferred Plan Transitions (00:01)**
Handles upgrades/downgrades at midnight to maintain clean financial boundaries and prevent pro-rata complexity.

---

## 🎨 Frontend Integration

### The `useFeatureGate` Hook
Reactive React hook to check feature access and plan status.
```typescript
const { hasAccess, requiredTier } = useFeatureGate(FEATURES.ORDERING);

if (!hasAccess) {
  return <UpgradePrompt tier={requiredTier} />;
}
```

### Visual Policy: Sidebar & Lock Icons
- Features unavailable in the current tier display a **Lock Icon** 🔒 in the sidebar.
- Clicking a locked feature triggers a premium **Upgrade Component** (located in `LockedFeature.tsx`) with a high-conversion CTA.

---

## 🛡️ Important Guardrails

> [!CAUTION]
> **The DIAMOND Upgrade Guardrail**
> To prevent restaurants from immediately falling into debt during an upgrade, a wallet balance of **1299 Coins** is required to switch to **DIAMOND**. This ensures nearly 2 months of floor coverage or initial commission liquidity.

> [!TIP]
> **SILVER Standalone Add-ons**
> Certain features like "Menu Theme Background" (100 coins/mo) can be purchased individually on the SILVER tier without moving to GOLD, providing a flexible "Menu a la carte" revenue stream.

---

**Version:** 2.0  
**Owner:** DineMatters Core Team  
**Last Updated:** April 2026

