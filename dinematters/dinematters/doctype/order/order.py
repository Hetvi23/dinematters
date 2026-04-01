import frappe
from frappe.model.document import Document
import math

class Order(Document):
    def before_save(self):
        # 1. Calculate Subtotal from items to ensure integrity
        calculated_subtotal = sum(float(item.total_price or 0) for item in self.get("order_items"))
        if calculated_subtotal > 0:
            self.subtotal = calculated_subtotal

        # 2. Fetch Tax Rate from Restaurant
        tax_rate = 5.0
        if self.restaurant:
            tax_rate = frappe.db.get_value("Restaurant", self.restaurant, "tax_rate")
            if tax_rate is None: tax_rate = 5.0
        
        self.tax_percent = tax_rate

        # 3. Calculate Taxes on (Subtotal - Discount)
        # Standard F&B: Tax is calculated on the amount after item/coupon discounts
        discountable_amount = float(self.subtotal or 0) - float(self.discount or 0)
        taxable_amount = max(0, discountable_amount)
        
        # Round to 2 decimal places for Currency fields
        tax_amount = round(taxable_amount * (float(tax_rate) / 100.0), 2)
        self.tax = tax_amount
        
        # Intra-state GST split (50/50)
        self.cgst = round(tax_amount / 2.0, 2)
        self.sgst = round(tax_amount - self.cgst, 2)

        # 4. Update Final Total
        # Total = (Subtotal - Discount) + Tax + Packaging + Delivery - Loyalty
        pkg_fee = float(self.packaging_fee or 0)
        del_fee = float(self.delivery_fee or 0)
        loyalty_disc = float(self.loyalty_discount or 0)
        
        self.total = taxable_amount + tax_amount + pkg_fee + del_fee - loyalty_disc

        # 5. Update Platform Fee (Dynamic commission on GMV)
        # GMV = total amount paid by customer
        # Field is 'platform_fee_amount' (Int, Paise)
        rate = float(frappe.db.get_value("Restaurant", self.restaurant, "platform_fee_percent") or 1.5) / 100.0
        self.platform_fee_amount = int(math.floor(float(self.total or 0) * rate * 100))

    def on_update(self):
        """
        Trigger commission deduction when order is confirmed/paid.
        Only applicable for PRO restaurants.
        """
        if self.status in ["confirmed", "completed", "billed"] or self.payment_status == "completed":
            # 1. Plan Awareness: Only PRO restaurants pay 1.5% commission
            plan_type = frappe.db.get_value("Restaurant", self.restaurant, "plan_type")
            if plan_type != "PRO":
                return

            # Avoid duplicate deductions
            if not frappe.db.exists("Coin Transaction", {
                "reference_doctype": "Order",
                "reference_name": self.name,
                "transaction_type": "Commission Deduction"
            }):
                from dinematters.dinematters.api.coin_billing import deduct_coins
                
                res_fee_percent = float(frappe.db.get_value("Restaurant", self.restaurant, "platform_fee_percent") or 1.5)
                commission_amt = float(self.total or 0) * (res_fee_percent / 100.0)
                
                if commission_amt > 0:
                    try:
                        deduct_coins(
                            restaurant=self.restaurant,
                            amount=commission_amt,
                            type="Commission Deduction",
                            description=f"{res_fee_percent}% Commission for Order {self.order_number}",
                            ref_doctype="Order",
                            ref_name=self.name
                        )
                    except Exception as e:
                        # Log error but don't block order update (to avoid blocking kitchen flow)
                        # Autopay should eventually recover this
                        frappe.log_error(f"Commission deduction failed for {self.name}: {str(e)}", "Commission Error")

        # Handle Cancellations (Refund if already charged)
        if self.status == "cancelled":
            # Check if deduction exists
            deduction_txn = frappe.db.get_value("Coin Transaction", {
                "reference_doctype": "Order",
                "reference_name": self.name,
                "transaction_type": "Commission Deduction"
            }, ["name", "amount"], as_dict=True)

            if deduction_txn:
                # Check if refund already exists
                if not frappe.db.exists("Coin Transaction", {
                    "reference_doctype": "Order",
                    "reference_name": self.name,
                    "transaction_type": "Refund"
                }):
                    from dinematters.dinematters.api.coin_billing import refund_coins
                    try:
                        refund_coins(
                            restaurant=self.restaurant,
                            amount=deduction_txn.amount,
                            description=f"Commission Refund for Cancelled Order {self.order_number}",
                            ref_doctype="Order",
                            ref_name=self.name
                        )
                    except Exception as e:
                        frappe.log_error(f"Commission refund failed for {self.name}: {str(e)}", "Refund Error")





