import json
import os
import base64
import logging
from typing import List, Dict, Any, Optional
import frappe
from .base import get_openai_client, handle_ai_error

logger = logging.getLogger(__name__)

class MenuExtractor:
    """Extract menu information from images using OpenAI Vision API"""
    
    def __init__(self):
        """Initialize OpenAI client"""
        self.client = get_openai_client()
        self.model = "gpt-4o"  # Using GPT-4o for best vision capabilities
    
    def encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def extract_from_images(
        self, 
        image_paths: List[str],
        restaurant_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract menu data from multiple images
        """
        # Prepare images for API
        image_contents = []
        for image_path in image_paths:
            if not os.path.exists(image_path):
                logger.warning(f"Image not found: {image_path}")
                continue
            
            # Check file size (OpenAI has limits)
            file_size = os.path.getsize(image_path)
            max_size = 20 * 1024 * 1024  # 20MB
            
            if file_size > max_size:
                logger.warning(f"Image too large: {image_path} ({file_size} bytes)")
                continue
            
            try:
                base64_image = self.encode_image(image_path)
                image_contents.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{base64_image}",
                        "detail": "high"  # High detail for better text recognition
                    }
                })
            except Exception as e:
                logger.error(f"Error encoding image {image_path}: {e}")
                continue
        
        if not image_contents:
            frappe.throw("No valid images provided for extraction")
        
        # Create comprehensive prompt for menu extraction
        system_prompt = self._get_extraction_prompt(restaurant_name)
        
        user_prompt = (
            "Analyze all provided menu images systematically and comprehensively. "
            "CRITICAL EXTRACTION PROCESS: "
            "1. First, scan all images to identify ALL categories/sections - go through each page methodically "
            "2. Then, for each category identified, extract EVERY item listed under that category "
            "3. Scan all areas: headers, footers, sidebars, small text, footnotes, and any text areas "
            "4. Extract complete menu information including: "
            "   - ALL categories with exact names (preserve original capitalization, Unicode, special characters) "
            "   - EVERY menu item with name, price, description, and category assignment "
            "   - Categories must exactly match (case-sensitive) between categories array and dish category fields "
            "   - Preserve exact text including special characters, Unicode characters, original capitalization, and formatting "
            "5. Work with any menu style, format, cuisine type, language, or establishment type "
            "6. Do not skip any items - extract everything visible in the menu images"
        )
        
        messages = [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    *image_contents
                ]
            }
        ]
        
        try:
            logger.info(f"Extracting menu from {len(image_contents)} images...")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.1,  # Low temperature for consistent extraction
                max_tokens=16384,  # Maximum tokens for detailed extraction
                response_format={"type": "json_object"}  # Force JSON response
            )
            
            result_text = response.choices[0].message.content
            if not result_text:
                logger.error("OpenAI returned empty content")
                raise ValueError("AI returned empty content. This may be due to safety filters or a model error.")
                
            logger.info("Menu extraction completed successfully")
            
            # Parse JSON response
            try:
                extracted_data = json.loads(result_text)
                return extracted_data
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                logger.error(f"Raw response: {result_text}")
                raise ValueError(f"Invalid JSON response from AI: {e}")
                
        except Exception as e:
            logger.error(f"Error during menu extraction: {e}")
            raise
    
    def _get_extraction_prompt(self, restaurant_name: Optional[str] = None) -> str:
        """Get the system prompt for menu extraction"""
        restaurant_context = f" for {restaurant_name}" if restaurant_name else ""
        
        return f"""You are an expert menu extraction system. Your task is to analyze menu images{restaurant_context} and extract all menu information into a structured JSON format.

This system works with ANY type of menu - restaurants, cafes, bars, food trucks, fine dining, fast food, international cuisine, or any dining establishment. Extract information regardless of menu style, format, language, or cuisine type.

CRITICAL EXTRACTION PRINCIPLES:
1. Extract EXACTLY what you see - preserve all characters, including Unicode, special characters, and diacritics
2. Extract EVERY item - do not skip any menu items, even if they seem similar or are in small text
3. Preserve exact spelling - do not normalize, correct, or modify names
4. Match category names exactly - dish categories must precisely match category names in the categories array
5. Be comprehensive - extract all visible information including prices, descriptions, and metadata

Extract the following information:

1. RESTAURANT BRANDING (restaurant-brand.json):
   - Restaurant/establishment name: Extract exactly as shown, preserving all characters
   - Tagline, subtitle, description: Extract if visible
   - Primary color: Extract if visible in menu design (hex code or color name)
   - Currency symbol: Extract from prices (₹, $, €, £, ¥, etc.)
   - Note: Logo, heroVideo, appleTouchIcon, and colorPalette cannot be extracted from menu images

2. CATEGORIES (categories.json):
   - CRITICAL: Extract ALL categories/sections visible in the menu images - scan thoroughly and systematically
   - Method: Go through each menu image page by page, section by section, identifying every category header
   - Look for: section headers, category titles, menu divisions, organizational groupings, any text that groups items together
   - Pay special attention to: small text, sidebars, footnotes, special sections, Unicode characters in category names, categories that might appear in different fonts or styles
   - Category IDs: Convert names to kebab-case format (lowercase, hyphens for spaces, remove special chars except hyphens)
   - Display names: Use the EXACT category names from the menu - preserve Unicode, special characters, ORIGINAL capitalization (extract exactly as shown, whether all caps, title case, or mixed case)
   - Descriptions: Extract if provided, otherwise leave empty
   - Mark special categories: If you see "Top Picks", "Chef Special", "Featured", "Popular", or similar labels, mark them appropriately
   - IMPORTANT: Every item must belong to a category. If items are grouped under headers/sections, those are categories
   - Do NOT skip any categories - if you see a category name anywhere in the menu, extract it
   - Do NOT assume category names - extract exactly what you see, including original capitalization

3. DISHES (dishes.json):
   For EACH menu item/product/service listed, extract:
   - CRITICAL: Extract EVERY item - go through each category systematically and list every item under it
   - Method: For each category you identified, extract all items listed under that category
   - id: Generate kebab-case ID from category and name (lowercase, hyphens, no special chars)
   - name: Full item name EXACTLY as shown - preserve Unicode, special characters, capitalization, punctuation, including parenthetical notes like "(eggless)"
   - price: Numeric price value only (extract the number, ignore currency symbol)
   - originalPrice: If there's a discount/strikethrough price shown (numeric value only)
   - category: Category name that EXACTLY matches one from categories array (case-sensitive, character-exact match)
   - description: Any description provided - extract exactly as shown, but keep concise (avoid excessive repetition)
   - isVegetarian: true/false - Look for explicit markers (🟢, Ⓥ, V, "Veg", "Vegetarian", etc.) or infer from ingredients/name if clear
   - calories: Extract if mentioned (numeric value only)
   - estimatedTime: Preparation/cooking time if mentioned (numeric value in minutes)
   - servingSize: Serving size if mentioned (extract exactly as shown: "1", "1-2", "2-3", "Serves 4", etc.)
   - quantity: Size/quantity if mentioned (extract exactly: "250ml", "350g", "12oz", "Large", etc.)
   - mainCategory: CRITICAL - High-level grouping based on item type. Use these specific categories:
     * "beverages" - For ALL drinks: coffee, tea, juice, soda, shakes, smoothies, cocktails, beer, wine, water, soup, etc.
     * "appetizers" - For starters, snacks, small plates, finger foods, tapas, samosas, spring rolls, etc.
     * "mains" - For main courses, entrees, full meals, rice dishes, pasta, curries, biryani, thalis, etc.
     * "desserts" - For sweets, cakes, ice cream, pastries, puddings, mithai, etc.
     * "bakery-desserts" - For baked goods that are desserts: cookies, brownies, muffins, croissants, etc.
     * "sides" - For side dishes, accompaniments, breads, salads (if not main), fries, etc.
     * "items" - ONLY use as last resort for items that don't clearly fit above categories
     IMPORTANT: Analyze the dish name and category to determine the correct mainCategory. For example:
     - "Pani Puri", "Dahi Puri", "Bhelpuri" → "appetizers" (street food/snacks)
     - "Tea", "Coffee", "Cold Coffee", "Soup" → "beverages"
     - "Chole Tikki", "Dahi Bhalla" → "appetizers" or "items" depending on context
     - "Biryani", "Thali", "Curry" → "mains"
     - "Ice Cream", "Gulab Jamun" → "desserts"
     DO NOT default to "items" - analyze each dish carefully and choose the most appropriate category.
   - customizationQuestions: If menu shows customization options (sizes, add-ons, modifications, etc.)
     - Structure: id (kebab-case), title, subtitle, type ("single" or "multiple"), required (boolean)
     - Options: id (kebab-case), label (exact text), price (numeric), isVegetarian (boolean), isDefault (boolean if applicable)
   - Note: media array cannot be extracted from menu images
   - Do NOT skip items - if you see an item name and price, extract it, even if it's in small text or unusual formatting

4. FILTERS (filters.json):
   - This will be generated dynamically by the system based on menu content
   - You can include basic filter structure if visible, but the system will optimize it

CRITICAL EXTRACTION RULES:
- Extract ALL items visible in the menu images - do not skip any, even if text is small, in footnotes, sidebars, or formatting is unusual
- Scan comprehensively: check all corners, headers, footers, sidebars, and any text areas for menu items
- Be thorough: go through each image multiple times if needed to ensure nothing is missed
- Count items: if a category has items listed, extract ALL of them - do not stop early
- Preserve EXACT text: names, descriptions, category names - do not normalize, correct spelling, or modify
- Preserve ORIGINAL capitalization: do not convert to all caps, all lowercase, or title case - keep exactly as shown
- Preserve Unicode characters: accented letters, special characters, emojis, diacritics - extract exactly as shown (e.g., "Mōrii" not "Morri")
- Use consistent category names: all dishes in the same visual category must use the exact same category name string (case-sensitive)
- Generate unique kebab-case IDs: lowercase, hyphens for spaces, remove special characters
- Category matching: dish category field must EXACTLY match (character-by-character, case-sensitive) a category name from categories array
- If information is not visible: omit the field (don't guess or assume)
- For vegetarian detection: Look for explicit markers first, then infer only if very clear from ingredients/name
- For customizations: Only extract if clearly shown in menu with options and prices
- Work with any menu format: vertical, horizontal, multi-column, single page, multi-page, grid, list, etc.
- Handle any cuisine type: Italian, Chinese, Mexican, Indian, American, fusion, etc.
- Handle any language: English, Spanish, French, Hindi, etc. - extract exactly as shown
- Handle any menu style: modern, traditional, minimalist, artistic, etc.
- Extract what you see, not what you expect to see
- Quality check: Before finalizing, verify that you've extracted all categories and all items under each category
- Keep responses concise: Extract all information but avoid excessive repetition or verbosity to stay within token limits

Return the complete JSON structure matching the exact format of the reference JSON files.
The response must be valid JSON with this structure:
{{
  "restaurantBrand": {{...}},
  "categories": [...],
  "dishes": [...],
  "filters": [...]
}}"""

class DescriptionGenerator:
    """Generate premium descriptions for menu items missing descriptions"""
    
    def __init__(self):
        """Initialize OpenAI client"""
        self.client = get_openai_client()
        self.model = "gpt-4o"  # Using GPT-4o for best quality descriptions
    
    def generate_missing_descriptions(
        self,
        dishes: List[Dict[str, Any]],
        restaurant_name: Optional[str] = None,
        categories: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate descriptions for dishes that are missing them
        """
        # Identify dishes missing descriptions
        dishes_needing_descriptions = [
            dish for dish in dishes
            if not dish.get("description") or dish.get("description").strip() == ""
        ]
        
        if not dishes_needing_descriptions:
            return dishes
        
        # Process in batches of 20 dishes at a time
        batch_size = 20
        updated_dishes = []
        dishes_with_descriptions = {dish["id"]: dish for dish in dishes if dish.get("description")}
        
        for i in range(0, len(dishes_needing_descriptions), batch_size):
            batch = dishes_needing_descriptions[i:i + batch_size]
            generated_descriptions = self._generate_batch_descriptions(
                batch=batch,
                restaurant_name=restaurant_name,
                categories=categories,
                all_dishes_context=dishes
            )
            
            # Update dishes with generated descriptions
            for dish in batch:
                dish_id = dish["id"]
                if dish_id in generated_descriptions:
                    dish["description"] = generated_descriptions[dish_id]
                updated_dishes.append(dish)
        
        # Combine
        existing_dishes = [d for d in dishes if d["id"] in dishes_with_descriptions]
        result = existing_dishes + updated_dishes
        return result
    
    def _generate_batch_descriptions(
        self,
        batch: List[Dict[str, Any]],
        restaurant_name: Optional[str] = None,
        categories: Optional[List[Dict[str, Any]]] = None,
        all_dishes_context: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, str]:
        """Generate descriptions for a batch of dishes"""
        # Prepare context information
        restaurant_context = f"Restaurant: {restaurant_name}\n" if restaurant_name else ""
        
        category_context = ""
        if categories:
            category_names = [cat.get("name", "") for cat in categories if cat.get("name")]
            if category_names:
                category_context = f"Menu Categories: {', '.join(category_names[:10])}\n"
        
        # Prepare dish information for generation
        dishes_info = []
        for dish in batch:
            dishes_info.append({
                "id": dish.get("id", ""),
                "name": dish.get("name", ""),
                "category": dish.get("category", ""),
                "price": dish.get("price", 0),
                "isVegetarian": dish.get("isVegetarian", False),
                "mainCategory": dish.get("mainCategory", ""),
            })
        
        # Create the prompt
        system_prompt = self._get_generation_prompt()
        user_prompt = self._build_user_prompt(
            dishes_info=dishes_info,
            restaurant_context=restaurant_context,
            category_context=category_context
        )
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {{"role": "system", "content": system_prompt}},
                    {{"role": "user", "content": user_prompt}}
                ],
                temperature=0.8,
                max_tokens=2048,
                response_format={{"type": "json_object"}}
            )
            
            result_data = json.loads(response.choices[0].message.content)
            
            descriptions = {}
            if "descriptions" in result_data:
                for item in result_data["descriptions"]:
                    dish_id = item.get("id")
                    description = item.get("description", "").strip()
                    if dish_id and description:
                        descriptions[dish_id] = description
            
            return descriptions
        except Exception as e:
            logger.error(f"Error during description generation: {e}")
            return {}
    
    def _get_generation_prompt(self) -> str:
        """Get the system prompt for description generation"""
        return """You are an expert culinary copywriter specializing in creating premium, appealing menu food item descriptions that entice customers while remaining clear and accessible to all audiences.

Your task is to generate high-quality, tempting descriptions for menu items based on their name, category, and available details.

CRITICAL DESCRIPTION QUALITY PRINCIPLES:

1. PREMIUM & APPEALING:
   - Use evocative, appetizing language that makes dishes sound irresistible
   - Highlight unique qualities, flavors, and textures
   - Create a sense of indulgence and quality
   - Use sensory language (taste, aroma, texture, appearance)

2. CLEAR & UNDERSTANDABLE:
   - Keep descriptions concise (15-30 words ideal, hard cap 40 words)
   - Use simple, accessible language - avoid overly complex culinary jargon
   - Ensure descriptions are understandable to all audiences, including non-native speakers
   - Be specific about key ingredients or preparation methods when relevant

3. AUTHENTIC & ACCURATE:
   - Base descriptions on the dish name and available information
   - Don't invent ingredients or features not suggested by the name
   - Match the style and tone to the dish category and restaurant type
   - If vegetarian/vegan, naturally incorporate that into the description

4. TEMPTING BUT HONEST:
   - Make dishes sound appealing without exaggeration
   - Focus on what makes the dish special or delicious
   - Use positive, inviting language
   - Create desire while maintaining credibility

DESCRIPTION STYLE GUIDELINES:

- Start with the most appealing aspect (flavor, texture, key ingredient, or preparation method)
- Use active, engaging language ("handcrafted", "slow-cooked", "freshly prepared")
- Include relevant details: cooking method, key ingredients, texture, or unique features
- For beverages: mention flavor profile, temperature, freshness, or special preparation
- For food items: mention preparation style, key ingredients, texture, or serving style
- End with a subtle appeal or benefit when natural

EXAMPLES OF GOOD DESCRIPTIONS:

- "Espresso": "Rich, bold single-origin espresso with balanced sweetness and fruity notes, delivering a smooth, aromatic experience"
- "Chocolate Smoothie": "Creamy, indulgent blend of premium chocolate and fresh ingredients, perfectly chilled for a refreshing treat"
- "Grilled Chicken Sandwich": "Tender, marinated chicken breast grilled to perfection, served on artisan bread with fresh vegetables and house-made sauce"
- "Caesar Salad": "Crisp romaine lettuce tossed with creamy Caesar dressing, parmesan cheese, and crunchy croutons"
- "Matcha Latte": "Smooth, earthy matcha green tea blended with steamed milk, creating a balanced and energizing beverage"

AVOID:
- Overly long descriptions (keep under 60 words)
- Complex culinary terms that confuse general audiences
- Generic phrases like "delicious" or "tasty" without specifics
- Exaggerated claims or false information
- Repetitive language across similar dishes

OUTPUT FORMAT (follow exactly):
{
  "descriptions": [
    {
      "id": "dish-id-1",
      "description": "Generated description here"
    },
    {
      "id": "dish-id-2",
      "description": "Generated description here"
    }
  ]
}

Generate one description per dish ID provided. Each description should be unique, appealing, and based on the dish information given.

Length & cleanliness rules (follow strictly):
- Target 15-30 words; NEVER exceed 40 words.
- Keep similar length to typical menu descriptions (concise, just a bit more vivid).
- Avoid filler/repetition; keep it tight and tempting.
- Return clean UTF-8 text with proper accents; no mojibake/garbled characters."""

    def _build_user_prompt(
        self,
        dishes_info: List[Dict[str, Any]],
        restaurant_context: str = "",
        category_context: str = ""
    ) -> str:
        """Build the user prompt with dish information"""
        prompt = f"Generate premium, appealing descriptions for the following menu items.\n\n{restaurant_context}{category_context}"
        for dish in dishes_info:
            prompt += f"- ID: {dish['id']}\n  Name: {dish['name']}\n  Category: {dish['category']}\n  Type: {'Vegetarian' if dish.get('isVegetarian') else 'Non-Vegetarian'}\n\n"
        prompt += "\nGenerate appealing descriptions for each item. Return the response as JSON with the structure specified in the system prompt."
        return prompt

@frappe.whitelist()
def extract_and_generate(image_paths, restaurant_name=None, generate_descriptions=True):
    """
    Unified extraction and description generation service
    """
    try:
        extractor = MenuExtractor()
        data = extractor.extract_from_images(image_paths, restaurant_name)
        
        if generate_descriptions and "dishes" in data:
            desc_gen = DescriptionGenerator()
            data["dishes"] = desc_gen.generate_missing_descriptions(
                data["dishes"], 
                restaurant_name, 
                data.get("categories")
            )
            
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        return handle_ai_error(e)
