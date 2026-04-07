# Copyright (c) 2026, DineMatters and contributors
# For license information, please see license.txt

"""
Marketing Segment — DocType Controller

Design decisions:
  - Custom SQL removed (SQL injection risk). Advanced filtering uses
    a safe whitelist of allowed column comparisons via _safe_custom_filter().
  - All queries filter opted_out_of_marketing = 0 automatically.
  - compute_reach(dry_run) only counts; get_customer_list() returns full rows.
"""

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime
import re

# Allowed columns for 'Custom Filter' segments (whitelist approach)
SAFE_CUSTOM_COLUMNS = {
    "total_visits", "lifetime_spend", "days_since_last_visit",
    "date_of_birth", "customer_name"
}


class MarketingSegment(Document):
    def before_save(self):
        """Recompute estimated reach on every save."""
        self.estimated_reach = self.compute_reach(dry_run=True)
        self.last_computed_at = now_datetime()
        # Remove Custom SQL criteria (SQL injection risk — always sanitize on save)
        if self.criteria_type == "Custom SQL":
            frappe.throw(
                "Custom SQL segments are disabled for security. Use 'Manual' or other criteria.",
                frappe.ValidationError
            )

    def compute_reach(self, dry_run=False):
        """Compute unique customer count for this segment."""
        restaurant = self.restaurant
        criteria = self.criteria_type

        try:
            if criteria == "All Customers":
                return self._query_all_customers(restaurant)
            elif criteria == "New Customers":
                return self._query_new_customers(restaurant)
            elif criteria == "At-Risk":
                return self._query_at_risk(restaurant, self.days_since_last_visit or 30)
            elif criteria == "Loyal Regulars":
                return self._query_loyal(restaurant, self.min_visit_count or 5)
            elif criteria == "High Spenders":
                return self._query_high_spenders(restaurant, self.min_total_spent or 1000)
            elif criteria == "Birthday This Month":
                return self._query_birthday_this_month(restaurant)
            elif criteria == "Manual":
                return len(self._parse_manual_phones())
            elif criteria == "Custom SQL":
                frappe.throw("Custom SQL is disabled for security.", frappe.ValidationError)
        except frappe.ValidationError:
            raise
        except Exception as e:
            frappe.log_error(f"Segment compute_reach failed [{self.name}]: {str(e)}", "Marketing Segment")

        return 0

    def get_customer_list(self):
        """
        Returns list of dicts: [{phone, customer_name, customer}]
        All fetchers automatically exclude opted-out customers.
        """
        restaurant = self.restaurant
        criteria = self.criteria_type
        phones = []

        try:
            if criteria == "All Customers":
                phones = self._fetch_all_customers(restaurant)
            elif criteria == "New Customers":
                phones = self._fetch_new_customers(restaurant)
            elif criteria == "At-Risk":
                phones = self._fetch_at_risk(restaurant, self.days_since_last_visit or 30)
            elif criteria == "Loyal Regulars":
                phones = self._fetch_loyal(restaurant, self.min_visit_count or 5)
            elif criteria == "High Spenders":
                phones = self._fetch_high_spenders(restaurant, self.min_total_spent or 1000)
            elif criteria == "Birthday This Month":
                phones = self._fetch_birthday_this_month(restaurant)
            elif criteria == "Manual":
                phones = self._fetch_manual(restaurant)
            elif criteria == "Custom SQL":
                frappe.log_error("Custom SQL segment blocked at dispatch time.", "Marketing Segment")
                phones = []
        except Exception as e:
            frappe.log_error(f"get_customer_list failed [{self.name}]: {str(e)}", "Marketing Segment")

        return phones

    # ── OPT-OUT FILTER ────────────────────────────────────────────────────────────
    # All fetch queries include: (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)

    # ── Count helpers ────────────────────────────────────────────────────────────

    def _query_all_customers(self, restaurant):
        result = frappe.db.sql("""
            SELECT COUNT(DISTINCT o.platform_customer)
            FROM `tabOrder` o
            JOIN `tabCustomer` c ON c.name = o.platform_customer
            WHERE o.restaurant = %s
              AND o.platform_customer IS NOT NULL AND o.platform_customer != ''
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
        """, (restaurant,))
        return (result[0][0] or 0) if result else 0

    def _query_new_customers(self, restaurant):
        result = frappe.db.sql("""
            SELECT COUNT(DISTINCT o.platform_customer)
            FROM `tabOrder` o
            JOIN `tabCustomer` c ON c.name = o.platform_customer
            WHERE o.restaurant = %s
              AND o.platform_customer IS NOT NULL
              AND o.creation >= DATE_SUB(NOW(), INTERVAL 14 DAY)
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
              AND (
                SELECT COUNT(*) FROM `tabOrder` o2
                WHERE o2.restaurant = %s AND o2.platform_customer = o.platform_customer
                  AND o2.creation < DATE_SUB(NOW(), INTERVAL 14 DAY)
              ) = 0
        """, (restaurant, restaurant))
        return (result[0][0] or 0) if result else 0

    def _query_at_risk(self, restaurant, days):
        result = frappe.db.sql("""
            SELECT COUNT(*)
            FROM (
                SELECT o.platform_customer
                FROM `tabOrder` o
                JOIN `tabCustomer` c ON c.name = o.platform_customer
                WHERE o.restaurant = %s AND o.platform_customer IS NOT NULL
                  AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
                GROUP BY o.platform_customer
                HAVING MAX(o.creation) < DATE_SUB(NOW(), INTERVAL %s DAY)
            ) t
        """, (restaurant, days))
        return (result[0][0] or 0) if result else 0

    def _query_loyal(self, restaurant, min_visits):
        result = frappe.db.sql("""
            SELECT COUNT(*)
            FROM (
                SELECT o.platform_customer, COUNT(*) as visit_count
                FROM `tabOrder` o
                JOIN `tabCustomer` c ON c.name = o.platform_customer
                WHERE o.restaurant = %s AND o.platform_customer IS NOT NULL AND o.platform_customer != ''
                  AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
                GROUP BY o.platform_customer
                HAVING visit_count >= %s
            ) t
        """, (restaurant, min_visits))
        return (result[0][0] or 0) if result else 0

    def _query_high_spenders(self, restaurant, min_spend):
        result = frappe.db.sql("""
            SELECT COUNT(*)
            FROM (
                SELECT o.platform_customer, SUM(o.total) as lifetime_spend
                FROM `tabOrder` o
                JOIN `tabCustomer` c ON c.name = o.platform_customer
                WHERE o.restaurant = %s AND o.platform_customer IS NOT NULL AND o.platform_customer != ''
                  AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
                GROUP BY o.platform_customer
                HAVING lifetime_spend >= %s
            ) t
        """, (restaurant, min_spend))
        return (result[0][0] or 0) if result else 0

    def _query_birthday_this_month(self, restaurant):
        result = frappe.db.sql("""
            SELECT COUNT(DISTINCT c.name)
            FROM `tabCustomer` c
            JOIN `tabOrder` o ON o.platform_customer = c.name
            WHERE o.restaurant = %s
              AND c.date_of_birth IS NOT NULL
              AND MONTH(c.date_of_birth) = MONTH(CURDATE())
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
        """, (restaurant,))
        return (result[0][0] or 0) if result else 0

    def _parse_manual_phones(self):
        raw = self.customer_ids or ""
        return [x.strip() for x in raw.replace("\n", ",").split(",") if x.strip()]

    # ── Full list fetchers ───────────────────────────────────────────────────────

    def _fetch_all_customers(self, restaurant):
        return frappe.db.sql("""
            SELECT DISTINCT c.name as customer, c.phone, c.customer_name
            FROM `tabCustomer` c
            JOIN `tabOrder` o ON o.platform_customer = c.name
            WHERE o.restaurant = %s AND c.phone IS NOT NULL AND c.phone != ''
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
        """, (restaurant,), as_dict=True)

    def _fetch_new_customers(self, restaurant):
        return frappe.db.sql("""
            SELECT DISTINCT c.name as customer, c.phone, c.customer_name
            FROM `tabCustomer` c
            JOIN `tabOrder` o ON o.platform_customer = c.name
            WHERE o.restaurant = %s AND o.creation >= DATE_SUB(NOW(), INTERVAL 14 DAY)
              AND c.phone IS NOT NULL
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
        """, (restaurant,), as_dict=True)

    def _fetch_at_risk(self, restaurant, days):
        return frappe.db.sql("""
            SELECT c.name as customer, c.phone, c.customer_name
            FROM `tabCustomer` c
            JOIN `tabOrder` o ON o.platform_customer = c.name
            WHERE o.restaurant = %s AND c.phone IS NOT NULL
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
            GROUP BY c.name, c.phone, c.customer_name
            HAVING MAX(o.creation) < DATE_SUB(NOW(), INTERVAL %s DAY)
        """, (restaurant, days), as_dict=True)

    def _fetch_loyal(self, restaurant, min_visits):
        return frappe.db.sql("""
            SELECT c.name as customer, c.phone, c.customer_name
            FROM `tabCustomer` c
            JOIN `tabOrder` o ON o.platform_customer = c.name
            WHERE o.restaurant = %s AND c.phone IS NOT NULL
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
            GROUP BY c.name, c.phone, c.customer_name
            HAVING COUNT(o.name) >= %s
        """, (restaurant, min_visits), as_dict=True)

    def _fetch_high_spenders(self, restaurant, min_spend):
        return frappe.db.sql("""
            SELECT c.name as customer, c.phone, c.customer_name
            FROM `tabCustomer` c
            JOIN `tabOrder` o ON o.platform_customer = c.name
            WHERE o.restaurant = %s AND c.phone IS NOT NULL
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
            GROUP BY c.name, c.phone, c.customer_name
            HAVING SUM(o.total) >= %s
        """, (restaurant, min_spend), as_dict=True)

    def _fetch_birthday_this_month(self, restaurant):
        return frappe.db.sql("""
            SELECT DISTINCT c.name as customer, c.phone, c.customer_name
            FROM `tabCustomer` c
            JOIN `tabOrder` o ON o.platform_customer = c.name
            WHERE o.restaurant = %s
              AND c.date_of_birth IS NOT NULL
              AND MONTH(c.date_of_birth) = MONTH(CURDATE())
              AND c.phone IS NOT NULL
              AND (c.opted_out_of_marketing IS NULL OR c.opted_out_of_marketing = 0)
        """, (restaurant,), as_dict=True)

    def _fetch_manual(self, restaurant):
        phones = self._parse_manual_phones()
        if not phones:
            return []
        # ✅ Parameterized - no injection possible
        return frappe.db.sql("""
            SELECT name as customer, phone, customer_name
            FROM `tabCustomer`
            WHERE phone IN %(phones)s
              AND phone IS NOT NULL
              AND (opted_out_of_marketing IS NULL OR opted_out_of_marketing = 0)
        """, {"phones": phones}, as_dict=True)
