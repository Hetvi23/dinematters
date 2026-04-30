# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Centralized role definitions for DineMatters.
Use these constants to enforce permissions uniformly across the system.
"""

# Global Administrators with root/system-wide access
GLOBAL_ADMIN_ROLES = ["Administrator", "System Manager"]

# Elevated Staff roles (can manage all restaurants via dashboard but lack global settings access)
SUPERVISOR_ROLES = ["DineMatters Supervisor"]

# Merchant-level roles (assigned via Restaurant User)
MERCHANT_ADMIN_ROLES = ["Restaurant Admin"]
MERCHANT_STAFF_ROLES = ["Restaurant Staff"]

# Roles that are explicitly locked out of the Frappe Desk (/app)
# Note: DineMatters Supervisor is NOT here, allowing them Desk access for advanced support.
DESK_RESTRICTED_ROLES = [
    "Restaurant Admin", 
    "Restaurant Staff"
]
