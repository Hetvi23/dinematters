import frappe
import requests
import json
import re
from frappe import _
from frappe.utils import now_datetime, get_datetime, add_days
from dinematters.dinematters.services.ai.base import get_openai_client, handle_ai_error

@frappe.whitelist()
def generate_seo_slug(text):
    """Generates a URL-friendly slug from text."""
    if not text:
        return ""
    slug = text.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    slug = re.sub(r'^-+|-+$', '', slug)
    return slug

def handle_product_update(doc, method=None):
    """
    Called from hooks on Menu Product update.
    - Generates slug if missing.
    - Syncs to Google if enabled.
    """
    try:
        if not doc.seo_slug:
            doc.seo_slug = generate_seo_slug(doc.product_name)
            # Use db_set to avoid re-triggering the on_update hook
            doc.db_set("seo_slug", doc.seo_slug, update_modified=False)

        # Use get_doc (not cached) to ensure fresh data with all fields
        restaurant = frappe.get_doc("Restaurant", doc.restaurant)
        # Use getattr with default to safely access the field
        if getattr(restaurant, "enable_google_sync", False):
            # Enqueue sync to avoid slowing down save
            frappe.enqueue(
                "dinematters.dinematters.api.google_business.sync_menu_to_google",
                restaurant_id=doc.restaurant,
                now=frappe.flags.in_test
            )
    except Exception as e:
        # Non-critical: log and continue — do NOT let this break product saves
        frappe.log_error("handle_product_update Error", str(e))

def fetch_all_restaurant_insights():
    """
    Fetch insights for all restaurants that have Google Sync enabled.
    """
    restaurants = frappe.get_all("Restaurant", filters={"enable_google_sync": 1}, fields=["name"])
    for r in restaurants:
        frappe.enqueue(
            "dinematters.dinematters.api.google_business.fetch_google_insights",
            restaurant_id=r.name
        )

@frappe.whitelist()
def get_google_auth_url(restaurant_id):
    """
    Returns the Google OAuth2 URL for the restaurant owner to authorize GMB management.
    Fetches credentials from frappe.conf.
    """
    client_id = frappe.conf.get("google_client_id")
    redirect_uri = frappe.conf.get("google_redirect_uri")
    
    if not client_id or not redirect_uri:
        frappe.throw(_("Google OAuth credentials (google_client_id, google_redirect_uri) are not configured in site config."))
    
    # Constructing a valid OAuth2 URL
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        "scope=https://www.googleapis.com/auth/business.manage&"
        f"state={restaurant_id}&"
        "access_type=offline&"
        "prompt=consent"
    )
    
    return {
        "auth_url": auth_url
    }

@frappe.whitelist()
def sync_menu_to_google(restaurant_id):
    """
    Syncs the DineMatters menu (categories and products) to Google Business Profile.
    """
    restaurant = frappe.get_doc("Restaurant", restaurant_id)
    if not restaurant.enable_google_sync:
        return {"success": False, "message": "Google Sync is disabled for this restaurant."}
    
    if not restaurant.google_business_location_id:
        return {"success": False, "message": "Google Location ID missing."}

    # Fetch all active products
    products = frappe.get_all("Menu Product", 
        filters={"restaurant": restaurant_id, "is_active": 1},
        fields=["name", "product_name", "description", "price", "category_name"]
    )

    # Group by category
    sections = {}
    for p in products:
        cat = p.category_name or "General"
        if cat not in sections:
            sections[cat] = []
        sections[cat].append({
            "name": p.product_name,
            "description": p.description or "",
            "price": p.price
        })

    # Prepare Google FoodMenus payload
    # Mocking the actual API call
    google_menu = {
        "sections": []
    }
    for cat, items in sections.items():
        google_menu["sections"].append({
            "displayName": cat,
            "items": [
                {
                    "displayName": item["name"],
                    "description": item["description"],
                    "price": {"currencyCode": restaurant.currency or "INR", "units": int(item["price"])}
                } for item in items
            ]
        })

    # In production, we'd call: 
    # PATCH https://mybusiness.googleapis.com/v1/{location}/foodMenus
    
    # Update local sync markers
    frappe.db.set_value("Restaurant", restaurant_id, "pos_last_sync_at", now_datetime())
    
    return {
        "success": True, 
        "message": f"Successfully synced {len(products)} items to Google Maps.",
        "synced_at": now_datetime()
    }

@frappe.whitelist()
def fetch_google_insights(restaurant_id):
    """
    Fetches performance data from Google Business Profile API.
    """
    restaurant = frappe.get_doc("Restaurant", restaurant_id)
    
    # Simulating data for "Discovery & Insights" dashboard
    import random
    
    # Monthly data for the last 6 months
    insights_data = {
        "monthly_views": [random.randint(500, 2000) for _ in range(6)],
        "direction_clicks": [random.randint(50, 300) for _ in range(6)],
        "website_visits": [random.randint(100, 500) for _ in range(6)],
        "calls": [random.randint(10, 50) for _ in range(6)],
        "labels": ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
    }
    
    # Save to cache
    restaurant.db_set("google_insights_data", json.dumps(insights_data), update_modified=False)
    
    return insights_data

@frappe.whitelist()
def generate_review_reply(review_text, rating, restaurant_id=None):
    """
    Uses OpenAI GPT-4o-Mini to generate a professional, SEO-optimized reply to a Google Review.
    Injects restaurant name, city, and top products for Local SEO visibility.
    """
    try:
        client = get_openai_client()
        
        # Fetch Context for SEO-Helping replies (Dhandha-style)
        res_context = ""
        if restaurant_id:
            res = frappe.get_cached_doc("Restaurant", restaurant_id)
            city = res.city or ""
            res_name = res.restaurant_name or res.name
            
            # Fetch top 5 products to suggest in positive reviews
            top_products = frappe.get_all("Menu Product", 
                filters={"restaurant": restaurant_id, "is_active": 1},
                fields=["product_name"],
                limit=5,
                order_by="creation desc"
            )
            product_list = ", ".join([p.product_name for p in top_products])
            
            res_context = f"""
            - Restaurant Name: {res_name}
            - Location: {city}
            - Signature Dishes: {product_list}
            """

        prompt = f"""
        You are an elite restaurant hospitality manager who specializes in Local SEO growth. 
        Write a reply to the following customer review that is both helpful and optimized for Google Local Search.
        
        Customer Rating: {rating} stars
        Review: "{review_text}"
        
        {f"Restaurant Context (Inject naturally into the reply): {res_context}" if res_context else ""}
        
        SEO & Hospitality Strategy:
        - Naturally integrate the RESTAURANT NAME and CITY into the response. 
        - If the rating is 4 or 5 stars: Thank them warmly, and mention a specific 'SIGNATURE DISH' they should try on their next visit to build keyword relevance.
        - If the rating is 1 to 3 stars: Apologize sincerely, show high empathy, and provide professional contact info to resolve it privately.
        - Style: Authoritative but extremely polite. 
        - Signature: "Best regards, The Team at [Restaurant Name]"
        - Keep it concise (2-4 sentences).
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional restaurant manager focused on customer happiness and Local SEO growth."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=250
        )
        
        reply = response.choices[0].message.content.strip()
        return {
            "success": True,
            "reply": reply
        }
    except Exception as e:
        return handle_ai_error(e)

@frappe.whitelist()
def get_google_reviews(restaurant_id):
    """
    Mock fetching Google Reviews for the dashboard.
    """
    # In production, call: GET https://mybusiness.googleapis.com/v1/{location}/reviews
    return [
        {
            "name": "Arjun Sharma",
            "rating": 5,
            "comment": "Amazing food! The butter chicken was to die for. Great service as well.",
            "createTime": "2026-04-10T14:30:00Z",
            "reviewId": "review_1"
        },
        {
            "name": "Priya Patel",
            "rating": 2,
            "comment": "Food was okay but it took 45 minutes to arrive. Not happy with the wait.",
            "createTime": "2026-04-12T19:20:00Z",
            "reviewId": "review_2"
        },
        {
            "name": "John Doe",
            "rating": 4,
            "comment": "Nice ambiance and good variety on the menu. A bit pricey but worth it.",
            "createTime": "2026-04-13T12:00:00Z",
            "reviewId": "review_3"
        }
    ]
