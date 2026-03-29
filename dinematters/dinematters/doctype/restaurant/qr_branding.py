import base64
import hashlib
import html
import os
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from io import BytesIO

import frappe
from frappe.utils import get_url

# Test background image overrides for development (only for testing)
# In production, use Restaurant Gallery, Media Assets, or Home Feature images
TEST_BACKGROUND_IMAGE_OVERRIDES = {
	"unvind": "/home/frappe/frappe-bench/apps/dinematters/image.png",
	"test": "/home/frappe/frappe-bench/apps/dinematters/image.png",
}

def normalize_qr_color(color):
	default_color = "#DB782F"
	if not color:
		return default_color

	try:
		from PIL import ImageColor

		candidate = color.strip()
		if re.fullmatch(r"[0-9a-fA-F]{6}", candidate):
			candidate = f"#{candidate}"
		ImageColor.getrgb(candidate)
		return candidate
	except Exception:
		return default_color


def safe_restaurant_path(value):
	return re.sub(r"[^a-z0-9-]", "", (value or "restaurant").lower()) or "restaurant"


def resolve_qr_branding(restaurant_doc):
	from dinematters.dinematters.media.utils import get_media_asset_data

	config_name = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant_doc.name}, "name")
	primary_color = None
	logo_url = ""
	background_image_url = ""

	if config_name:
		config_values = frappe.db.get_value(
			"Restaurant Config",
			config_name,
			["primary_color", "logo"],
			as_dict=True,
		) or {}
		primary_color = config_values.get("primary_color")
		logo_url = get_media_asset_data(
			"Restaurant Config",
			config_name,
			"restaurant_config_logo",
			config_values.get("logo") or restaurant_doc.logo,
		).get("url", "")

	if not logo_url and restaurant_doc.logo:
		logo_url = get_url(restaurant_doc.logo) if restaurant_doc.logo.startswith("/") else restaurant_doc.logo

	# For LITE users, ALWAYS use Dinematters logo (override any custom logo)
	if restaurant_doc.plan_type == 'LITE':
		# Use Dinematters logo for LITE users (uploaded to CDN)
		logo_url = "/files/dinematters-logoddffe5.svg"
		# Fallback to local file if CDN file doesn't exist
		if not frappe.db.exists("File", {"file_url": logo_url}):
			logo_url = "/dinematters/images/dinematters-logo.svg"

	for media_role in ["restaurant_gallery_image", "restaurant_banner"]:
		background_image_url = frappe.db.get_value(
			"Media Asset",
			{
				"owner_doctype": "Restaurant",
				"owner_name": restaurant_doc.name,
				"media_role": media_role,
				"status": "ready",
				"is_active": 1,
				"is_deleted": 0,
			},
			"primary_url",
		)
		if background_image_url:
			break

	# Fallback to Home Feature "The Place" image if no restaurant gallery/banner
	if not background_image_url:
		# First try to get from Media Asset (more reliable than image_src field)
		home_feature_name = frappe.db.get_value(
			"Home Feature",
			{
				"restaurant": restaurant_doc.name,
				"title": "The Place",
			},
			"name",
		)
		if home_feature_name:
			# Get the Media Asset for this Home Feature
			home_feature_asset = frappe.db.get_value(
				"Media Asset",
				{
					"owner_doctype": "Home Feature",
					"owner_name": home_feature_name,
					"media_role": "home_feature_image",
					"status": "ready",
					"is_active": 1,
				},
				"primary_url",
			)
			if home_feature_asset and not home_feature_asset.endswith('.svg'):
				background_image_url = home_feature_asset
			# Fallback to image_src field if no Media Asset
			elif not home_feature_asset:
				home_feature_image = frappe.db.get_value("Home Feature", home_feature_name, "image_src")
				if home_feature_image and not home_feature_image.endswith('.svg'):
					background_image_url = get_url(home_feature_image) if home_feature_image.startswith("/") else home_feature_image

	if not background_image_url:
		background_image_url = TEST_BACKGROUND_IMAGE_OVERRIDES.get(restaurant_doc.name) or TEST_BACKGROUND_IMAGE_OVERRIDES.get(restaurant_doc.restaurant_id)

	return {
		"restaurant_name": restaurant_doc.restaurant_name or restaurant_doc.name,
		"primary_color": normalize_qr_color(primary_color),
		"logo_url": logo_url,
		"background_image_url": background_image_url,
	}


def build_table_qr_url(restaurant_doc, table_number):
	base_url = getattr(restaurant_doc, "base_url", None) or "https://app.dinematters.com/"
	return f"{base_url.rstrip('/')}/{restaurant_doc.restaurant_id}?table_no={table_number}"


def build_table_qr_cache_key(restaurant_doc, table_number, qr_url, branding, force=False):
	import time
	
	payload = "|".join(
		[
			"v8",
			str(restaurant_doc.restaurant_id or ""),
			str(table_number),
			str(qr_url or ""),
			str(branding.get("restaurant_name") or ""),
			str(branding.get("primary_color") or ""),
			str(branding.get("logo_url") or ""),
			str(branding.get("background_image_url") or ""),
		]
	)
	
	# Add timestamp when forcing regeneration to ensure unique cache key
	if force:
		payload += f"|{int(time.time())}"
	
	return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def build_table_qr_object_keys(restaurant_doc, table_number, cache_key):
	restaurant_key = safe_restaurant_path(restaurant_doc.restaurant_id or restaurant_doc.name)
	base_path = f"restaurants/{restaurant_key}/restaurant/{restaurant_key}/table_qr/{table_number}/{cache_key}"
	return {
		"svg": f"{base_path}/card.svg",
		"png": f"{base_path}/card.png",
	}


def read_logo_bytes(logo_url):
	if not logo_url:
		return None

	try:
		from PIL import Image
		from dinematters.dinematters.media.storage import download_object
		from dinematters.dinematters.media.config import get_cdn_config
		
		# Handle CDN URLs by downloading from R2
		cdn_config = get_cdn_config()
		cdn_base = cdn_config["base_url"]
		if logo_url.startswith(cdn_base):
			# Extract object key from CDN URL
			object_key = logo_url[len(cdn_base):].lstrip('/')
			# Download from R2 to temp file
			with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
				temp_path = temp_file.name
			try:
				download_object(object_key, temp_path)
				# Check if it's an SVG file
				if object_key.endswith('.svg') or temp_path.endswith('.svg'):
					# For SVG files, read directly and convert to PNG using a different approach
					return convert_svg_to_png(temp_path)
				else:
					# For raster images, use PIL
					with Image.open(temp_path) as img:
						img = img.convert("RGBA")
						img.thumbnail((320, 320), Image.Resampling.LANCZOS)
						buffer = BytesIO()
						img.save(buffer, format="PNG")
						return buffer.getvalue()
			finally:
				if os.path.exists(temp_path):
					os.remove(temp_path)
		
		# Handle local file paths
		resolved_url = logo_url
		if resolved_url.startswith("/"):
			# For local files, check if they exist and open directly
			if os.path.exists(resolved_url):
				# Check if it's an SVG file
				if resolved_url.endswith('.svg'):
					# For SVG files, read directly and convert to PNG
					return convert_svg_to_png(resolved_url)
				else:
					# For raster images, use PIL
					with Image.open(resolved_url) as img:
						img = img.convert("RGBA")
						img.thumbnail((320, 320), Image.Resampling.LANCZOS)
						buffer = BytesIO()
						img.save(buffer, format="PNG")
						return buffer.getvalue()
			else:
				# Try to get URL if local file doesn't exist
				resolved_url = get_url(resolved_url)

		# Handle HTTP URLs (for localhost or other accessible URLs)
		with urllib.request.urlopen(resolved_url, timeout=10) as response:
			content = response.read()
			# Check if it's an SVG file by content type or extension
			if resolved_url.endswith('.svg') or b'<svg' in content[:100]:
				# Save SVG to temp file and convert
				with tempfile.NamedTemporaryFile(delete=False, suffix='.svg') as temp_file:
					temp_file.write(content)
					temp_path = temp_file.name
				try:
					return convert_svg_to_png(temp_path)
				finally:
					if os.path.exists(temp_path):
						os.remove(temp_path)
			else:
				# For raster images, use PIL
				with Image.open(BytesIO(content)) as img:
					img = img.convert("RGBA")
					img.thumbnail((320, 320), Image.Resampling.LANCZOS)
					buffer = BytesIO()
					img.save(buffer, format="PNG")
					return buffer.getvalue()
	except Exception as e:
		print(f"Error reading logo {logo_url}: {e}")
		return None


def convert_svg_to_png(svg_path):
	"""Convert SVG to PNG using cairosvg or fallback method"""
	try:
		# Try using cairosvg if available
		import cairosvg
		png_bytes = cairosvg.svg2png(url=svg_path, output_width=320, output_height=320)
		return png_bytes
	except ImportError:
		# Fallback: use a simple method to create a placeholder
		# For now, we'll create a simple colored square as placeholder
		from PIL import Image, ImageDraw, ImageFont
		img = Image.new('RGBA', (320, 320), (255, 87, 34, 255))  # Orange background
		draw = ImageDraw.Draw(img)
		
		# Draw a simple "D" for Dinematters
		try:
			font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
		except:
			font = ImageFont.load_default()
		
		draw.text((80, 100), "D", fill=(255, 255, 255, 255), font=font)
		
		buffer = BytesIO()
		img.save(buffer, format="PNG")
		return buffer.getvalue()
	except Exception as e:
		print(f"Error converting SVG to PNG: {e}")
		# Return a simple placeholder
		from PIL import Image, ImageDraw
		img = Image.new('RGBA', (320, 320), (255, 87, 34, 255))
		buffer = BytesIO()
		img.save(buffer, format="PNG")
		return buffer.getvalue()


def read_background_image_bytes(image_url, size=(940, 980)):
	if not image_url:
		return None

	try:
		from PIL import Image, ImageEnhance, ImageOps
		
		# Handle local file paths first (before any frappe-dependent operations)
		if image_url.startswith("/"):
			# For local files, check if they exist and open directly
			if os.path.exists(image_url):
				with Image.open(image_url) as img:
					img = img.convert("RGB")
					img = ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.78))
					img = ImageEnhance.Brightness(img).enhance(0.75)
					buffer = BytesIO()
					img.save(buffer, format="JPEG", quality=75, optimize=True)
					return buffer.getvalue()
			else:
				# Try to get URL if local file doesn't exist
				image_url = get_url(image_url) if image_url.startswith("/") else image_url
		
		# For non-local files or if local file doesn't exist, try CDN/HTTP handling
		try:
			from dinematters.dinematters.media.storage import download_object
			from dinematters.dinematters.media.config import get_cdn_config
			
			# Handle CDN URLs by extracting object key and downloading from R2
			cdn_config = get_cdn_config()
			cdn_base = cdn_config["base_url"]
			if image_url.startswith(cdn_base):
				# Extract object key from CDN URL
				object_key = image_url[len(cdn_base):].lstrip('/')
				# Download from R2 to temp file
				with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
					temp_path = temp_file.name
				try:
					download_object(object_key, temp_path)
					with Image.open(temp_path) as img:
						img = img.convert("RGB")
						img = ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.78))
						img = ImageEnhance.Brightness(img).enhance(0.75)
						buffer = BytesIO()
						img.save(buffer, format="JPEG", quality=75, optimize=True)
						return buffer.getvalue()
				finally:
					if os.path.exists(temp_path):
						os.remove(temp_path)
		except Exception:
			# If CDN handling fails, fall back to HTTP
			pass
		
		# Handle HTTP URLs (for localhost or other accessible URLs)
		resolved_url = get_url(image_url) if image_url.startswith("/") else image_url
		with urllib.request.urlopen(resolved_url, timeout=10) as response:
			with Image.open(BytesIO(response.read())) as img:
				img = img.convert("RGB")
				img = ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.78))
				img = ImageEnhance.Brightness(img).enhance(0.75)
				buffer = BytesIO()
				img.save(buffer, format="JPEG", quality=75, optimize=True)
				return buffer.getvalue()
	except Exception as e:
		print(f"Error reading image {image_url}: {e}")
		return None


def extract_svg_payload(svg_markup):
	root = ET.fromstring(svg_markup)
	view_box = root.attrib.get("viewBox")
	if not view_box:
		width = root.attrib.get("width", "100")
		height = root.attrib.get("height", "100")
		width_num = re.sub(r"[^0-9.]", "", str(width)) or "100"
		height_num = re.sub(r"[^0-9.]", "", str(height)) or "100"
		view_box = f"0 0 {width_num} {height_num}"
	inner_markup = "".join(ET.tostring(child, encoding="unicode") for child in list(root))
	return view_box, inner_markup


def load_font(size, bold=False):
	from PIL import ImageFont

	font_candidates = [
		"/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
		"/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
		"/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
		"/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/dejavu/DejaVuSans.ttf",
	]
	for font_path in font_candidates:
		if os.path.exists(font_path):
			return ImageFont.truetype(font_path, size)
	return ImageFont.load_default()


def measure_text(draw, text, font):
	bbox = draw.textbbox((0, 0), text, font=font)
	return bbox[2] - bbox[0], bbox[3] - bbox[1]


def generate_svg_card(qr_data, restaurant_name, brand_color, table_number, logo_bytes, background_image_bytes):
	import qrcode
	from qrcode.image.svg import SvgPathImage

	qr = qrcode.QRCode(
		version=None,
		error_correction=qrcode.constants.ERROR_CORRECT_H,
		box_size=16,
		border=4,
		image_factory=SvgPathImage,
	)
	qr.add_data(qr_data)
	qr.make(fit=True)
	buffer = BytesIO()
	qr.make_image(fill_color=brand_color, back_color="white").save(buffer)
	qr_markup = buffer.getvalue().decode("utf-8")
	view_box, inner_markup = extract_svg_payload(qr_markup)

	logo_overlay_markup = ""
	background_markup = ""
	if background_image_bytes:
		background_b64 = base64.b64encode(background_image_bytes).decode("ascii")
		background_markup = (
			'<defs><clipPath id="scanner-panel-clip"><rect x="130" y="360" width="940" height="980" rx="48" ry="48"/></clipPath></defs>'
			f'<image x="130" y="360" width="940" height="980" href="data:image/png;base64,{background_b64}" preserveAspectRatio="xMidYMid slice" clip-path="url(#scanner-panel-clip)"/>'
			'<rect x="130" y="360" width="940" height="980" rx="48" fill="#000000" opacity="0.08"/>'
		)
	if logo_bytes and not background_image_bytes:
		logo_b64 = base64.b64encode(logo_bytes).decode("ascii")
		logo_overlay_markup = (
			'<rect x="510" y="750" width="180" height="180" rx="42" fill="white" stroke="#E7E7E7" stroke-width="8"/>'
			f'<image x="535" y="775" width="130" height="130" href="data:image/png;base64,{logo_b64}" preserveAspectRatio="xMidYMid meet"/>'
		)
	cutout_markup = '<rect x="300" y="530" width="600" height="600" rx="46" fill="white" fill-opacity="0.96" stroke="#F0E8F3" stroke-width="4"/>'
	qr_group = (
		f'<svg x="340" y="570" width="520" height="520" viewBox="{html.escape(view_box)}">'
		f"{inner_markup}</svg>"
	)
	footer = "Powered by Dinematters"
	return (
		'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">'
		'<rect width="1200" height="1600" rx="72" fill="#FFFFFF"/>'
		f'<rect x="52" y="52" width="1096" height="1496" rx="56" fill="#FFFFFF" stroke="{brand_color}" stroke-width="18"/>'
		f'<text x="600" y="210" text-anchor="middle" font-family="Baskerville, Georgia, Times New Roman, serif" font-size="44" font-weight="600" fill="{brand_color}">Table {table_number}</text>'
		f'{background_markup}<rect x="130" y="360" width="940" height="980" rx="48" fill="none" stroke="{brand_color}" stroke-opacity="0.28" stroke-width="3"/>{cutout_markup}{qr_group}{logo_overlay_markup}'
		f'<text x="600" y="1365" text-anchor="middle" font-family="Baskerville, Georgia, Times New Roman, serif" font-size="42" font-weight="600" fill="#555555">Scan to order</text>'
		f'<text x="600" y="1450" text-anchor="middle" font-family="Baskerville, Georgia, Times New Roman, serif" font-size="36" fill="#666666">{html.escape(footer)}</text>'
		'</svg>'
	).encode("utf-8")


def build_artistic_qr_image(qr_data, logo_bytes, background_image_bytes):
	import segno
	from PIL import Image

	# Use logo for the artistic QR center
	if not logo_bytes:
		return None
		
	logo_stream = BytesIO(logo_bytes)
	target_stream = BytesIO()
	qr = segno.make(qr_data, error="h")
	
	# Generate artistic QR with logo as background
	qr.to_artistic(background=logo_stream, target=target_stream, scale=8, kind="png", border=0)
	
	target_stream.seek(0)
	qr_img = Image.open(target_stream).convert("RGB")
	
	# Convert to RGBA and ensure white background
	final_img = Image.new("RGBA", qr_img.size, "white")
	final_img.paste(qr_img, (0, 0))

	return final_img


def generate_png_card(qr_data, restaurant_name, brand_color, table_number, logo_bytes, background_image_bytes):
	import qrcode
	from PIL import Image, ImageDraw, ImageOps

	def draw_text_with_shadow(draw_obj, position, text, font, fill, shadow_fill=(0, 0, 0, 170), shadow_offset=(3, 4)):
		x, y = position
		draw_obj.text((x + shadow_offset[0], y + shadow_offset[1]), text, fill=shadow_fill, font=font)
		draw_obj.text((x, y), text, fill=fill, font=font)

	canvas = Image.new("RGBA", (1200, 1600), "white")
	draw = ImageDraw.Draw(canvas)
	if background_image_bytes:
		with Image.open(BytesIO(background_image_bytes)) as bg_img:
			bg_img = bg_img.convert("RGBA")
			bg_img = ImageOps.fit(bg_img, (1096, 1496), method=Image.Resampling.LANCZOS, centering=(0.5, 0.78))
			canvas.paste(bg_img, (52, 52), bg_img)
	else:
		draw.rounded_rectangle((52, 52, 1148, 1548), radius=56, fill="white")

	title_font = load_font(72, bold=True)
	subtitle_font = load_font(46, bold=True)
	footer_font = load_font(66, bold=True)
	brand_font = load_font(56, bold=False)

	bottom_band = Image.new("RGBA", (1096, 220), (0, 0, 0, 170))
	canvas.paste(bottom_band, (52, 1328), bottom_band)

	# Generate QR code with logo embedded if both logo and background exist
	qr_img = None
	logo_applied_in_qr = False
	
	if logo_bytes and background_image_bytes:
		try:
			# Use artistic QR with logo in center
			qr_img = build_artistic_qr_image(qr_data, logo_bytes, background_image_bytes)
			qr_img = qr_img.resize((520, 520), Image.Resampling.LANCZOS)
			logo_applied_in_qr = True
		except Exception as e:
			print(f"Artistic QR failed: {e}")
			qr_img = None
	
	# Fallback to regular QR if artistic failed or no logo/background
	if qr_img is None:
		qr = qrcode.QRCode(
			version=None,
			error_correction=qrcode.constants.ERROR_CORRECT_H,
			box_size=20,
			border=4,
		)
		qr.add_data(qr_data)
		qr.make(fit=True)
		qr_img = qr.make_image(fill_color=brand_color, back_color="white").convert("RGBA")
		qr_img = qr_img.resize((520, 520), Image.Resampling.NEAREST)
	
	# Paste QR on canvas
	canvas.paste(qr_img, (340, 570), qr_img if qr_img.mode == 'RGBA' else None)

	if logo_bytes and not logo_applied_in_qr and not background_image_bytes:
		with Image.open(BytesIO(logo_bytes)) as logo_img:
			logo_img = logo_img.convert("RGBA")
			logo_img.thumbnail((130, 130), Image.Resampling.LANCZOS)
			logo_card = Image.new("RGBA", (180, 180), (255, 255, 255, 0))
			logo_draw = ImageDraw.Draw(logo_card)
			logo_draw.rounded_rectangle((4, 4, 176, 176), radius=42, fill="white", outline="#E7E7E7", width=8)
			logo_x = (180 - logo_img.width) // 2
			logo_y = (180 - logo_img.height) // 2
			logo_card.paste(logo_img, (logo_x, logo_y), logo_img)
			canvas.paste(logo_card, (510, 750), logo_card)

	scan_text = f"Scan to order - Table {table_number}"
	scan_width, _ = measure_text(draw, scan_text, footer_font)
	draw_text_with_shadow(draw, ((1200 - scan_width) / 2, 1370), scan_text, footer_font, fill="#FFFFFF", shadow_fill=(0, 0, 0, 210), shadow_offset=(3, 4))

	brand_text = "Powered by Dinematters"
	brand_width, _ = measure_text(draw, brand_text, brand_font)
	draw_text_with_shadow(draw, ((1200 - brand_width) / 2, 1450), brand_text, brand_font, fill="#F3F3F3", shadow_fill=(0, 0, 0, 210), shadow_offset=(3, 4))

	buffer = BytesIO()
	canvas.save(buffer, format="PNG", optimize=True)
	return buffer.getvalue()


def upload_content_bytes(content, suffix, object_key, content_type):
	from dinematters.dinematters.media.storage import upload_object

	with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
		temp_file.write(content)
		temp_path = temp_file.name
	try:
		return upload_object(temp_path, object_key, content_type=content_type)
	finally:
		if os.path.exists(temp_path):
			os.remove(temp_path)


def ensure_table_qr_assets(restaurant_doc, table_number, force=False, branding=None, logo_bytes=None, background_image_bytes=None):
	from dinematters.dinematters.media.storage import get_cdn_url, verify_object_exists

	# Use provided branding or fetch it (for backward compatibility)
	if branding is None:
		branding = resolve_qr_branding(restaurant_doc)
	
	qr_url = build_table_qr_url(restaurant_doc, table_number)
	cache_key = build_table_qr_cache_key(restaurant_doc, table_number, qr_url, branding, force=force)
	object_keys = build_table_qr_object_keys(restaurant_doc, table_number, cache_key)

	# Always regenerate when force=True, regardless of whether files exist
	if not force:
		svg_exists = verify_object_exists(object_keys["svg"]).get("exists")
		png_exists = verify_object_exists(object_keys["png"]).get("exists")

		if svg_exists and png_exists:
			return {
				"table_number": table_number,
				"qr_data": qr_url,
				"cache_key": cache_key,
				"svg_url": get_cdn_url(object_keys["svg"]),
				"png_url": get_cdn_url(object_keys["png"]),
				"svg_object_key": object_keys["svg"],
				"png_object_key": object_keys["png"],
			}

	# Use provided images or download them (for backward compatibility)
	if logo_bytes is None:
		logo_bytes = read_logo_bytes(branding.get("logo_url"))
	if background_image_bytes is None:
		background_image_bytes = read_background_image_bytes(branding.get("background_image_url"))
	
	svg_bytes = generate_svg_card(
		qr_url,
		branding["restaurant_name"],
		branding["primary_color"],
		table_number,
		logo_bytes,
		background_image_bytes,
	)
	png_bytes = generate_png_card(
		qr_url,
		branding["restaurant_name"],
		branding["primary_color"],
		table_number,
		logo_bytes,
		background_image_bytes,
	)

	svg_url = upload_content_bytes(svg_bytes, ".svg", object_keys["svg"], "image/svg+xml")
	png_url = upload_content_bytes(png_bytes, ".png", object_keys["png"], "image/png")

	return {
		"table_number": table_number,
		"qr_data": qr_url,
		"cache_key": cache_key,
		"svg_url": svg_url,
		"png_url": png_url,
		"svg_object_key": object_keys["svg"],
		"png_object_key": object_keys["png"],
	}


def build_table_qr_assets(restaurant_doc, force=False):
	if not restaurant_doc.restaurant_id:
		frappe.throw("Restaurant ID is required to generate QR codes")
	if not restaurant_doc.tables or restaurant_doc.tables <= 0:
		frappe.throw("Number of tables must be greater than 0")

	# Download branding images once and reuse for all tables
	branding = resolve_qr_branding(restaurant_doc)
	logo_bytes = read_logo_bytes(branding.get("logo_url"))
	background_image_bytes = read_background_image_bytes(branding.get("background_image_url"))
	
	return [
		ensure_table_qr_assets(
			restaurant_doc, 
			table_number, 
			force=force,
			branding=branding,
			logo_bytes=logo_bytes,
			background_image_bytes=background_image_bytes
		) 
		for table_number in range(1, restaurant_doc.tables + 1)
	]
