app_name = "dinematters"
app_title = "Dinematters"
app_publisher = "Hetvi Patel"
app_description = "POS and backend for Dinematters"
app_email = "hetvipatel2302@gmail.com"
app_license = "mit"

# CI/CD: Auto-deployment enabled via GitHub Actions
# Last deployment test: 2025-12-24

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "dinematters",
# 		"logo": "/assets/dinematters/logo.png",
# 		"title": "Dinematters",
# 		"route": "/dinematters",
# 		"has_permission": "dinematters.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/dinematters/css/dinematters.css"
# app_include_js = "/assets/dinematters/js/dinematters.js"

# include js, css files in header of web template
# web_include_css = "/assets/dinematters/css/dinematters.css"
# web_include_js = "/assets/dinematters/js/dinematters.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "dinematters/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "dinematters/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "dinematters.utils.jinja_methods",
# 	"filters": "dinematters.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "dinematters.install.before_install"
# after_install = "dinematters.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "dinematters.uninstall.before_uninstall"
# after_uninstall = "dinematters.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "dinematters.utils.before_app_install"
# after_app_install = "dinematters.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "dinematters.utils.before_app_uninstall"
# after_app_uninstall = "dinematters.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "dinematters.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

permission_query_conditions = {
	"Restaurant": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Menu Product": "dinematters.dinematters.utils.permission_helpers.get_menu_product_permissions",
	"Menu Category": "dinematters.dinematters.utils.permission_helpers.get_menu_category_permissions",
	"Order": "dinematters.dinematters.utils.permission_helpers.get_order_permissions",
	"Cart Entry": "dinematters.dinematters.utils.permission_helpers.get_cart_entry_permissions",
	"Coupon": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Offer": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Event": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Game": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Table Booking": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Banquet Booking": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Restaurant Config": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Home Feature": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Legacy Content": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Menu Image Extractor": "dinematters.dinematters.utils.permission_helpers.get_restaurant_permission_query_conditions",
	"Restaurant User": "dinematters.dinematters.utils.permission_helpers.get_restaurant_user_permission_query_conditions",
}

has_permission = {
	"Restaurant": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Menu Product": "dinematters.dinematters.utils.permission_helpers.has_menu_product_permission",
	"Menu Category": "dinematters.dinematters.utils.permission_helpers.has_menu_category_permission",
	"Order": "dinematters.dinematters.utils.permission_helpers.has_order_permission",
	"Cart Entry": "dinematters.dinematters.utils.permission_helpers.has_cart_entry_permission",
	"Coupon": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Offer": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Event": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Game": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Table Booking": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Banquet Booking": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Restaurant Config": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Home Feature": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Legacy Content": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Menu Image Extractor": "dinematters.dinematters.utils.permission_helpers.has_restaurant_permission",
	"Restaurant User": "dinematters.dinematters.utils.permission_helpers.has_restaurant_user_permission",
}

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

scheduler_events = {
	"daily": [
		"dinematters.dinematters.tasks.monthly_reconciliation.reconcile_transfers"
	],
	"hourly": [
		"dinematters.dinematters.api.payments.process_retry_charges"
	],
	"cron": {
		"0 0 * * *": [  # Run daily at midnight, each restaurant handled on its onboarding date
			"dinematters.dinematters.tasks.monthly_reconciliation_onboarding.process_monthly_minimums_by_onboarding_date",
		]
	}
}

# Testing
# -------

# before_tests = "dinematters.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "dinematters.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "dinematters.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# CORS Configuration for Frontend Access
before_request = ["dinematters.dinematters.utils.cors_helpers.handle_cors_preflight"]
after_request = ["dinematters.dinematters.utils.cors_helpers.add_cors_headers"]

# Job Events
# ----------
# before_job = ["dinematters.utils.before_job"]
# after_job = ["dinematters.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"dinematters.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Website Route Rules
# -------------------
# URL routing for dinematters UI (similar to Mint)
website_route_rules = [{'from_route': '/dinematters/<path:app_path>', 'to_route': 'dinematters'}]

# Redirect root to dinematters so unauthenticated users land on dinematters login
# (ProtectedRoute then redirects to /dinematters/login)
website_redirects = [{"source": "/", "target": "/dinematters"}]

