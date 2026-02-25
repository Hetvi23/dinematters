import frappe
from frappe.model.document import Document
import math


class MonthlyBillingLedger(Document):
    def validate(self):
        # Ensure uniqueness per restaurant + month
        existing = frappe.db.exists("Monthly Billing Ledger", {
            "restaurant": self.restaurant,
            "billing_month": self.billing_month,
            "name": ("!=", self.name)
        })
        if existing:
            frappe.throw(f"Monthly Billing Ledger already exists for {self.restaurant} in {self.billing_month}")

    def before_save(self):
        # Calculate fee and final amount if totals are present
        try:
            total_gmv = int(self.total_gmv or 0)
            calculated_fee = int(math.floor((total_gmv / 100.0) * 0.01)) if total_gmv else 0
            # calculated_fee above was incorrect for paise conversion; recalc correctly:
            calculated_fee = int(math.floor(total_gmv * 0.01))
            # Apply min/max (amounts in paise)
            min_amt = 999 * 100
            max_amt = 3999 * 100
            final_amount = max(min_amt, min(calculated_fee, max_amt))
            self.calculated_fee = calculated_fee
            self.final_amount = final_amount
        except Exception:
            # If any calculation fails, leave fields as-is and log
            frappe.log_error("Failed to calculate billing amounts", "monthly_billing_ledger.validate")

