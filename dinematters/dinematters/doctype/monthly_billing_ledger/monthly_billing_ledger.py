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
            
            # Fetch commission settings from Restaurant
            platform_fee_percent = 1.5
            monthly_min = 999
            if self.restaurant:
                res_info = frappe.db.get_value("Restaurant", self.restaurant, 
                    ["platform_fee_percent", "monthly_minimum"], as_dict=True)
                if res_info:
                    platform_fee_percent = float(res_info.platform_fee_percent or 1.5)
                    monthly_min = float(res_info.monthly_minimum or 999)

            # 1. Calculate Base Commission (e.g. 1.5% with ₹999 floor)
            calculated_fee = int(math.floor(total_gmv * (platform_fee_percent / 100.0)))
            min_amt_paise = int(monthly_min * 100)
            base_commission = max(min_amt_paise, calculated_fee)
            
            # 2. GST Compliance (18% SaaS tax)
            tax_rate = float(self.tax_percent or 18.0)
            gst_amount = int(math.floor(base_commission * (tax_rate / 100.0)))
            
            # 3. Final Amount
            final_total = base_commission + gst_amount

            self.calculated_fee = base_commission
            self.gst_amount = gst_amount
            self.tax_percent = tax_rate
            self.final_amount = final_total
            self.notes = f"Base Commission: ₹{base_commission/100:.2f}, GST ({tax_rate}%): ₹{gst_amount/100:.2f}"
        except Exception as e:
            frappe.log_error(f"Failed to calculate billing: {str(e)}", "monthly_billing_ledger.before_save")

