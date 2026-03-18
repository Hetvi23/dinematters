import frappe
import requests
import json
import base64
import os
import uuid
import random
from dinematters.dinematters.media.storage import upload_object, get_cdn_url, generate_object_key

def get_random_reference_image():
    """Selects a random image from the internal reference_images directory."""
    # Internal app path is more secure than public folder for static assets used by AI
    ref_folder = frappe.get_app_path("dinematters", "dinematters", "media", "reference_images")
    
    if os.path.exists(ref_folder):
        files = [f for f in os.listdir(ref_folder) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        if files:
            return os.path.join(ref_folder, random.choice(files))
            
    # Absolute fallback to public images if internal is somehow missing
    images_folder = frappe.get_app_path("dinematters", "public", "dinematters", "images")
    return os.path.join(images_folder, "login-dinematters.png")

@frappe.whitelist(allow_guest=False)
def upload_base64_image(filename, filedata):
    """
    Standardized base64 upload handler for AI Image Enhancement.
    """
    # Decoding base64
    content = base64.b64decode(filedata)
    
    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": filename,
        "content": content,
        "is_private": 0
    })
    file_doc.save(ignore_permissions=True)
    frappe.db.commit()
    
    return {"file_url": file_doc.file_url}

@frappe.whitelist(allow_guest=False)
def enqueue_enhancement(restaurant, owner_doctype, owner_name, original_image_url=None, mode="enhance", include_branding=False):
    """
    Creates an AI Image Generation record and enqueues a job.
    mode="enhance" costs 5 credits and requires original_image_url.
    mode="generate" costs 8 credits and uses only product info + reference image.
    """
    from dinematters.dinematters.api.ai_billing import deduct_credits_for_enhancement

    BASE_COST = 8 if mode == "generate" else 5
    BRANDING_COST = 2 if include_branding else 0
    CREDIT_COST = BASE_COST + BRANDING_COST

    # Step 1: Verify credit balance before even creating the doc
    balance = frappe.db.get_value("Restaurant", restaurant, "ai_credits") or 0
    if balance < CREDIT_COST:
        frappe.throw(
            f"Insufficient AI credits. You need {CREDIT_COST} credits but only have {balance}. "
            "Please recharge your AI credit wallet.",
            frappe.ValidationError
        )

    if mode == "enhance" and not original_image_url:
        frappe.throw("original_image_url is required for enhance mode.", frappe.ValidationError)

    doc = frappe.get_doc({
        "doctype": "AI Image Generation",
        "restaurant": restaurant,
        "owner_doctype": owner_doctype,
        "owner_name": owner_name,
        "original_image_url": original_image_url or "",
        "status": "Pending_Upload"
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    # Step 2: Deduct credits immediately
    try:
        deduct_credits_for_enhancement(restaurant=restaurant, generation_id=doc.name, credits=CREDIT_COST)
    except Exception as e:
        # Rollback the generation document if credit deduction fails
        frappe.delete_doc("AI Image Generation", doc.name, ignore_permissions=True)
        frappe.db.commit()
        frappe.throw(str(e))

    # Step 3: Enqueue background job
    frappe.enqueue(
        "dinematters.dinematters.api.ai_media.process_ai_image_enhancement",
        queue="default",
        timeout=300,
        generation_name=doc.name,
        mode=mode,
        include_branding=include_branding,
        credits_to_refund=CREDIT_COST
    )

    return {"generation_id": doc.name}

@frappe.whitelist(allow_guest=False)
def get_enhancement_status(generation_id):
    """Returns the status and output of a generation."""
    if not frappe.db.exists("AI Image Generation", generation_id):
        frappe.throw("Invalid Generation ID")
    
    doc = frappe.get_doc("AI Image Generation", generation_id)
    return {
        "status": doc.status,
        "enhanced_image_url": doc.enhanced_image_url,
        "error_message": doc.error_message
    }

@frappe.whitelist(allow_guest=False)
def get_generative_gallery(restaurant, limit=50):
    """Returns a list of completed generations for a restaurant."""
    generations = frappe.get_all("AI Image Generation", 
        filters={
            "restaurant": restaurant,
            "status": "Completed"
        },
        fields=["name", "creation", "owner_name", "original_image_url", "enhanced_image_url", "video_url"],
        order_by="creation desc",
        limit=limit
    )
    return generations

@frappe.whitelist(allow_guest=False)
def download_proxy(file_url, filename=None):
    """Proxy to fetch cross-origin images and force download."""
    if not file_url:
        frappe.throw("File URL is required")
        
    import requests
    response = requests.get(file_url, stream=True)
    response.raise_for_status()
    
    if not filename:
        filename = file_url.split("/")[-1].split("?")[0] or "download.png"
        if "." not in filename:
            filename += ".png"

    frappe.response.filename = filename
    frappe.response.filecontent = response.content
    frappe.response.type = "download"

@frappe.whitelist(allow_guest=False)
def apply_to_product(generation_id, replace_index=None):
    """Applies the enhanced image to Menu Product."""
    doc = frappe.get_doc("AI Image Generation", generation_id)
    if doc.status != "Completed":
        frappe.throw("Cannot apply an incomplete generation.")
    if doc.owner_doctype != "Menu Product":
        frappe.throw("Only Menu Product is supported for auto-apply right now.")
        
    product = frappe.get_doc("Menu Product", doc.owner_name)
    
    # Replacement Logic
    if replace_index is not None:
        idx = int(replace_index)
        if idx < len(product.product_media):
            # Replace existing
            product.product_media[idx].media_url = doc.enhanced_image_url
            product.product_media[idx].media_type = "image"
            product.product_media[idx].media_asset = None
        else:
            # Append if index is out of bounds (fallback)
            product.append("product_media", {
                "media_type": "image",
                "media_url": doc.enhanced_image_url,
                "display_order": len(product.product_media) + 1,
                "alt_text": "AI Enhanced Image"
            })
    else:
        # Standard Append
        product.append("product_media", {
            "media_type": "image",
            "media_url": doc.enhanced_image_url,
            "display_order": len(product.product_media) + 1,
            "alt_text": "AI Enhanced Image"
        })
        
    product.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True}

def download_image(url):
    temp_path = f"/tmp/{uuid.uuid4().hex}.jpg"
    
    if url.startswith("/files/"):
        # Local Frappe file
        site_path = frappe.get_site_path("public")
        file_path = os.path.join(site_path, url.replace("/files/", "files/"))
        if not os.path.exists(file_path):
            frappe.throw(f"Local file not found: {file_path}")
        with open(file_path, "rb") as f_in, open(temp_path, "wb") as f_out:
            f_out.write(f_in.read())
        return temp_path

    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(temp_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    return temp_path

def generate_image_gemini(image_path, dish_name, dish_description, dish_category=None, include_branding=False, restaurant_name=None):
    """Uses Gemini 2.5 Flash Image for native image-to-image enhancement."""
    gemini_key = frappe.conf.get("gemini_api_key")
    if not gemini_key:
        frappe.throw("Gemini API key required for generation")
    
    # Load input image
    with open(image_path, "rb") as f:
        img_data = f.read()
    
    # Load random local reference image
    ref_path = get_random_reference_image()
    
    with open(ref_path, "rb") as f:
        ref_data = f.read()

    description_text = f"Dish Details: {dish_description}" if dish_description else ""
    category_text = f"Category: {dish_category}" if dish_category else ""
    
    branding_text = ""
    if include_branding and restaurant_name:
        branding_text = (
            f"\nBRANDING INSTRUCTIONS: Incorporate the restaurant name '{restaurant_name}' in a minimalistic, professional way like in photography or pinterest level"
            f"It could be on the plating utensils (like a subtle engraving on a spoon or fork), "
            f"on a napkin, or discretely in the background (like eg on wooden table). "
            f"Keep it elegant and integrated into the scene."
        )

    prompt = (
        f"Disclaimer: Don't generate whole new image as per you, generated image should be aligned with first image."
        f"Convert (first image) which is {dish_name} image into professional food photography, restaurant menu photography, "
        f"magazine quality Pinterest-Style Images editorial food photography highly detailed. \n"
        f"{category_text}\n"
        f"{description_text}\n"
        f"{branding_text}\n"
        f"Note: I HAVE ALSO ATTACHED REFERENCE IMAGE (second image) FOR THE VISUALS I AM EXPECTING IN IMAGE, AND MAKE SURE THE BACKGROUND IS HAVING INGREDIENTS OR SIDES OR GARNISHES OR SERVING STYLE RELATED TO DISH"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={gemini_key}"
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(img_data).decode('utf-8')}},
                {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(ref_data).decode('utf-8')}}
            ]
        }]
    }
    
    response = requests.post(url, json=payload)
    response.raise_for_status()
    res_json = response.json()
    
    # Extract image from response
    if 'candidates' in res_json and res_json['candidates']:
        for part in res_json['candidates'][0]['content']['parts']:
            if 'inlineData' in part:
                # Save to a temporary file and return the path
                temp_output = f"/tmp/{uuid.uuid4().hex}.png"
                with open(temp_output, "wb") as f:
                    f.write(base64.b64decode(part['inlineData']['data']))
                return temp_output
                
    frappe.throw("Gemini failed to generate an image in the response.")

def generate_image_gemini_from_product(dish_name, dish_description, dish_category=None, include_branding=False, restaurant_name=None):
    """Generates a NEW food photo from scratch using only product info + reference image."""
    gemini_key = frappe.conf.get("gemini_api_key")
    if not gemini_key:
        frappe.throw("Gemini API key required for generation")

    # Load random local reference image
    ref_path = get_random_reference_image()

    with open(ref_path, "rb") as f:
        ref_data = f.read()

    description_text = f"Dish Details: {dish_description}" if dish_description else ""
    category_text = f"Category: {dish_category}" if dish_category else ""

    branding_text = ""
    if include_branding and restaurant_name:
        branding_text = (
            f"\nBRANDING INSTRUCTIONS: Incorporate the restaurant name '{restaurant_name}' in a minimalistic, professional way like in photography or pinterest level"
            f"It could be on the plating utensils (like a subtle engraving on a spoon or fork), "
            f"on a napkin, or discretely in the background (like eg on wooden table). "
            f"Keep it elegant and integrated into the scene."
        )

    prompt = (
        f"Generate a brand-new, original, professional food photography image of '{dish_name}'. "
        f"Style: restaurant menu photography, magazine-quality, Pinterest-style, editorial food photography, highly detailed. "
        f"The dish should be beautifully plated, with relevant garnishes, ingredients, or sides visible in the background. "
        f"{category_text}\n"
        f"{description_text}\n"
        f"{branding_text}\n"
        f"IMPORTANT: Use the attached REFERENCE IMAGE only for the visual style, lighting, and composition you should aim for — NOT as the dish itself. "
        f"Generate an entirely new image of '{dish_name}'. Do NOT copy or reproduce the reference dish."
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={gemini_key}"
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(ref_data).decode('utf-8')}}
            ]
        }]
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()
    res_json = response.json()

    if 'candidates' in res_json and res_json['candidates']:
        for part in res_json['candidates'][0]['content']['parts']:
            if 'inlineData' in part:
                temp_output = f"/tmp/{uuid.uuid4().hex}.png"
                with open(temp_output, "wb") as f:
                    f.write(base64.b64decode(part['inlineData']['data']))
                return temp_output

    frappe.throw("Gemini failed to generate a new image from product details.")


def process_ai_image_enhancement(generation_name, mode="enhance", include_branding=False, credits_to_refund=0):
    """Background Job Handler"""
    from dinematters.dinematters.api.ai_billing import refund_credits_for_failed_enhancement

    frappe.db.set_value("AI Image Generation", generation_name, "status", "Processing")
    frappe.db.commit()
    
    doc = frappe.get_doc("AI Image Generation", generation_name)

    temp_input_path = None
    temp_output_path = None
    
    try:
        # Get extra context
        restaurant_name = frappe.db.get_value("Restaurant", doc.restaurant, "restaurant_name")
        dish_name = "Dish"
        dish_description = ""
        dish_category = ""
        
        if doc.owner_doctype == "Menu Product":
            product = frappe.get_doc("Menu Product", doc.owner_name)
            dish_name = product.product_name
            dish_description = product.description or ""
            dish_category = product.category or ""

        if mode == "generate":
            # Generate a new photo from scratch — no input image needed
            temp_output_path = generate_image_gemini_from_product(dish_name, dish_description, dish_category, include_branding, restaurant_name)
        else:
            # Enhance the uploaded photo
            # 1. Download input
            temp_input_path = download_image(doc.original_image_url)

            # 2. Generate enhanced image using Gemini
            temp_output_path = generate_image_gemini(temp_input_path, dish_name, dish_description, dish_category, include_branding, restaurant_name)
        
        # 4. Upload to R2 (temp_output_path is already set by generator above)

        # 5. Upload to R2
        uid = frappe.generate_hash(length=8)
        object_key = generate_object_key(
            restaurant_id=doc.restaurant,
            owner_doctype=doc.owner_doctype,
            owner_name=doc.owner_name,
            media_role="product_image",
            media_id=uid,
            filename="enhanced.jpg",
            variant="lg"
        )
        
        r2_cdn_url = upload_object(temp_output_path, object_key, content_type="image/jpeg")

        # 6. Save back to DB
        frappe.db.set_value("AI Image Generation", generation_name, "enhanced_image_url", r2_cdn_url)
        frappe.db.set_value("AI Image Generation", generation_name, "status", "Completed")
        frappe.db.commit()

    except Exception as e:
        frappe.db.set_value("AI Image Generation", generation_name, "status", "Failed")
        frappe.db.set_value("AI Image Generation", generation_name, "error_message", str(e))
        frappe.db.commit()
        frappe.log_error(f"AI Generation Failed: {str(e)}", "AI Media Enhancement")

        # Auto-refund credits on failure
        if credits_to_refund > 0:
            try:
                refund_credits_for_failed_enhancement(
                    restaurant=doc.restaurant,
                    generation_id=generation_name,
                    credits=credits_to_refund
                )
            except Exception as refund_err:
                frappe.log_error(f"Credit Refund Failed for {generation_name}: {str(refund_err)}", "AI Billing Refund")

    finally:
        # Cleanup
        if temp_input_path and os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if temp_output_path and os.path.exists(temp_output_path):
            os.remove(temp_output_path)
