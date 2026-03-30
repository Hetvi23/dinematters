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

        # 5. Update Platform Fee (1.5% commission on GMV)
        # GMV = total amount paid by customer
        # Field is 'platform_fee_amount' (Int, Paise)
        self.platform_fee_amount = int(math.floor(float(self.total or 0) * 0.015 * 100))





