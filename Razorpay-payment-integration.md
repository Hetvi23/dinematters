Perfect. I’ll write this as **production-grade Razorpay integration documentation** tailored exactly for:

* ✅ 1.5% platform fee to DINEMATTERS
* ✅ ₹999 minimum monthly per restaurant
* ❌ No pay-at-counter token system
* ✅ Next.js frontend
* ✅ ERPNext (Frappe) backend
* ✅ Razorpay Route (Marketplace split settlement)

You can paste this directly into Cursor.

---

# 📄 DINEMATTERS – Razorpay Marketplace Integration Documentation

---

# 1️⃣ Overview

DINEMATTERS will integrate with **Razorpay Route (Marketplace Model)** to:

* Collect full order payment from customer
* Automatically deduct 1.5% platform fee for DINEMATTERS
* Instantly transfer remaining amount to restaurant sub-account
* Enforce ₹999 minimum monthly fee per outlet

No pay-at-counter or token system.

---

# 2️⃣ Business Rules

## Platform Fee

* 1.5% of total order amount
* No cap
* Deducted automatically via split settlement

## Monthly Minimum

* Each restaurant must pay minimum ₹999/month
* If total 1.5% fees collected < ₹999
* Difference is auto-invoiced at month-end

---

# 3️⃣ Architecture

### Frontend

Next.js (DINEMATTERS UI)

### Backend

ERPNext (Frappe server)

ERPNext handles:

* Order creation
* Payment order generation
* Webhook verification
* Monthly reconciliation

---

# 4️⃣ Razorpay Account Setup

## Step 1 – Create Razorpay Business Account

Register DINEMATTERS as Marketplace/Platform.

## Step 2 – Enable Route Product

Request activation of:

* Route (Linked Accounts)
* Transfers
* Split settlements

---

# 5️⃣ Restaurant Onboarding Flow

Each restaurant must have:

* Linked Razorpay Account
* Completed KYC
* Bank account verified

---

## API – Create Linked Account (ERPNext Server Side)

Endpoint:
POST [https://api.razorpay.com/v2/accounts](https://api.razorpay.com/v2/accounts)

Example payload:

```json
{
  "email": "restaurant@email.com",
  "phone": "9999999999",
  "type": "route",
  "reference_id": "rest_123",
  "legal_business_name": "ABC Restaurant",
  "business_type": "partnership",
  "contact_name": "Owner Name"
}
```

Store in ERPNext:

* razorpay_account_id
* kyc_status
* settlement_status

---

# 6️⃣ Order Payment Flow

## Step 1 – Customer Places Order (Next.js)

Frontend calls ERPNext API:

POST /api/create-payment-order

With:

* restaurant_id
* order_items
* total_amount

---

## Step 2 – ERPNext Calculates Platform Fee

```
platform_fee = total_amount * 0.015
restaurant_amount = total_amount - platform_fee
```

No cap.

---

## Step 3 – ERPNext Creates Razorpay Order with Split

POST [https://api.razorpay.com/v1/orders](https://api.razorpay.com/v1/orders)

```json
{
  "amount": 100000,
  "currency": "INR",
  "payment_capture": 1,
  "transfers": [
    {
      "account": "acc_xxxxx",
      "amount": 98500,
      "currency": "INR"
    }
  ]
}
```

Where:

* 100000 = ₹1000 in paise
* 98500 = ₹985 restaurant amount
* ₹15 automatically retained by DINEMATTERS

Return:

* razorpay_order_id
* amount
* key_id

To Next.js frontend.

---

# 7️⃣ Next.js Checkout Implementation

Load Razorpay Checkout script.

Initialize:

```javascript
const options = {
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY,
  amount: order.amount,
  currency: "INR",
  order_id: order.razorpay_order_id,
  handler: function (response) {
    fetch("/api/payment-verify", {
      method: "POST",
      body: JSON.stringify(response)
    });
  }
};

const rzp = new window.Razorpay(options);
rzp.open();
```

---

# 8️⃣ Webhook Verification (ERPNext)

Add webhook in Razorpay Dashboard:

Events:

* payment.captured
* transfer.processed
* refund.processed

---

## ERPNext Webhook Endpoint

Steps:

1. Read raw body
2. Validate signature:

```
generated_signature = HMAC_SHA256(secret, body)
```

3. Compare with header:
   X-Razorpay-Signature

If valid:

* Mark order as CONFIRMED
* Save razorpay_payment_id
* Save transfer_id
* Update monthly fee ledger

---

# 9️⃣ ERPNext Doctype Changes

## Restaurant Doctype

Add fields:

* razorpay_account_id
* monthly_minimum = 999
* platform_fee_percent = 1.5

---

## Order Doctype

Add fields:

* razorpay_order_id
* razorpay_payment_id
* payment_status
* platform_fee_amount
* restaurant_transfer_amount

---

## Monthly Revenue Ledger Doctype (NEW)

Fields:

* restaurant
* month (YYYY-MM)
* total_gmv
* total_platform_fee
* minimum_due
* status

---

# 🔟 Monthly Minimum Logic

Cron job (1st of every month):

For each restaurant:

```
if total_platform_fee < 999:
    minimum_due = 999 - total_platform_fee
else:
    minimum_due = 0
```

If minimum_due > 0:

Generate Razorpay Payment Link:

POST [https://api.razorpay.com/v1/payment_links](https://api.razorpay.com/v1/payment_links)

Send link to restaurant.

Mark status = pending

---

# 1️⃣1️⃣ Refund Handling

If order refunded:

* Reverse platform fee proportionally
* Adjust monthly ledger
* Use Razorpay refund API

---

# 1️⃣2️⃣ Security Requirements

* Never trust frontend success callback
* Always verify webhook signature
* Store webhook payload logs
* Use environment-based Razorpay keys
* Separate test and live modes

---

# 1️⃣3️⃣ Settlement Flow

Razorpay automatically:

* Deducts 1.5% (DINEMATTERS share)
* Transfers remaining to restaurant
* Settles as per T+1 or configured schedule

DINEMATTERS does NOT hold restaurant funds.

---

# 1️⃣4️⃣ Testing Plan

In Test Mode:

* Create test linked accounts
* Simulate payment
* Validate split settlement
* Validate webhook verification
* Validate monthly ledger update

Only after full success:
Complete KYC and go live.

---

# 1️⃣5️⃣ Edge Cases

Handle:

* Payment failed
* Webhook retry
* Partial refund
* Duplicate webhook
* Expired order

Order should auto-expire in 10 minutes if unpaid.

---

# Final Summary

DINEMATTERS Revenue Model:

* 1.5% auto deducted via split settlement
* ₹999 minimum monthly enforced via ledger + invoice
* No pay-at-counter
* No token system
* Fully automated

---

If you want next, I can create:

* ERPNext Frappe server script template
* Production-grade webhook verification snippet for Frappe
* Or a database ER diagram for clarity
