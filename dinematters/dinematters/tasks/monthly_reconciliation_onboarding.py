import frappe
from dateutil.relativedelta import relativedelta
import math

@frappe.whitelist()
def process_monthly_minimums_by_onboarding_date():
	"""Run daily: create Monthly Billing Ledger for restaurants whose onboarding day matches today."""
	try:
		from datetime import datetime
		import calendar
		today = datetime.now().date()
		previous_month = (today - relativedelta(months=1)).strftime("%Y-%m")
		last_day_current = calendar.monthrange(today.year, today.month)[1]

		restaurants = frappe.get_all("Restaurant", filters={"is_active": 1}, fields=["name", "onboarding_date", "monthly_minimum"])
		created = []
		for r in restaurants:
			try:
				od = r.get("onboarding_date")
				if not od:
					continue
				if isinstance(od, str):
					od_day = int(od.split("-")[-1])
				else:
					od_day = od.day
				match_day = od_day if od_day <= last_day_current else last_day_current
				if today.day != match_day:
					continue

				# skip if ledger already exists
				if frappe.db.exists("Monthly Billing Ledger", {"restaurant": r.get("name"), "billing_month": previous_month}):
					continue

				# Sum completed orders for the previous month
				total = frappe.db.sql("""
					SELECT COALESCE(SUM(total),0) FROM `tabOrder`
					WHERE restaurant=%s AND payment_status='completed' AND DATE_FORMAT(creation, '%%Y-%%m')=%s
				""", (r.get("name"), previous_month))[0][0] or 0
				total_paise = int(float(total) * 100)
				calculated_fee = int(math.floor(total_paise * 0.01))
				min_amt = 999 * 100
				max_amt = 3999 * 100
				final_amount = max(min_amt, min(calculated_fee, max_amt))

				ledger = frappe.get_doc({
					"doctype": "Monthly Billing Ledger",
					"restaurant": r.get("name"),
					"billing_month": previous_month,
					"total_gmv": total_paise,
					"calculated_fee": calculated_fee,
					"final_amount": final_amount,
					"payment_status": "pending"
				})
				ledger.insert(ignore_permissions=True)
				created.append(ledger.name)
			except Exception as e:
				frappe.log_error(f"Failed onboarding monthly for {r.get('name')}: {str(e)}", "razorpay.monthly_onboarding")
		return {"success": True, "created": created}
	except Exception as e:
		frappe.log_error(f"process_monthly_minimums_by_onboarding_date failed: {str(e)}", "razorpay.monthly_onboarding_error")
		return {"success": False, "error": str(e)}

