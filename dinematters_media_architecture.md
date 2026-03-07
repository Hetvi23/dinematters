Below is a **true 10/10 production-grade implementation** for **Dinematters media system integrated with Frappe / ERPNext**.
It stays **simple enough to implement**, but **powerful enough to scale to millions of images/videos**.

I designed it specifically for the current Dinematters codebase:

- **Frappe / ERPNext as system of record**
- **FastAPI proxy layer already present**
- **Current `Attach` / `Attach Image` usage in doctypes**
- **Current `Product Media` child table on `Menu Product`**
- **Need for low-cost, high-speed public media delivery**

---

# Dinematters Media Architecture (Codebase-Specific 10/10 Blueprint)

## Objective

Build a media platform for Dinematters that is:

- **fastest for end users**
- **reliable in production**
- **cheap to operate**
- **compatible with the current codebase**
- **incrementally adoptable without breaking existing flows**

This document is the target architecture for product images, product videos, restaurant branding media, and future gallery media.

---

# Current Codebase Reality

Current implementation already in the repository:

- `Menu Product` uses a `product_media` child table
- `Product Media` rows store:
  - `media_url`
  - `media_type`
  - `display_order`
  - `alt_text`
  - `caption`
- frontend `ProductMediaTable.tsx` uploads directly to Frappe using:
  - `POST /api/method/upload_file`
- product API serializes media by returning stored URLs
- `Restaurant` and `Restaurant Config` still use plain `Attach` / `Attach Image` fields such as:
  - `logo`
  - `hero_video`

This works for small-scale attachment handling, but it is **not yet a production-grade media platform**.

Main limitations of the current model:

- uploads pass through Frappe file handling
- no direct object storage upload flow
- no processing state machine
- no CDN-first immutable variant strategy
- no dedicated metadata model for media lifecycle
- no async optimization pipeline for public media
- no robust video poster / variant workflow

---

# Final Architecture Decision

## Core rule

For **customer-facing media**, Dinematters should move from **Frappe file attachments** to:

- **Cloudflare R2** for storage
- **Cloudflare CDN** for delivery
- **Frappe DocTypes** for metadata and permissions
- **Frappe background jobs** for processing
- **FastAPI** for media session APIs used by frontend/mobile clients

## Responsibility split

### Frappe owns

- business authorization
- media metadata
- media-to-document linking
- queue enqueueing
- processing state updates
- admin visibility and auditability

### FastAPI owns

- media upload session APIs
- edge-friendly authenticated media endpoints
- rate limiting for upload/session endpoints
- thin request handling with no business logic duplication

### Cloudflare owns

- raw object storage
- processed object storage
- global CDN delivery

---

# Final Media Flow

```text
Frontend / Mobile Client
  -> request upload session
  -> upload directly to Cloudflare R2
  -> confirm upload
  -> Frappe creates Media Asset record
  -> Frappe background worker processes asset
  -> optimized variants saved to R2
  -> CDN URLs stored in metadata
  -> frontend renders CDN URLs only
```

This ensures:

- **minimal app server load**
- **fast upload and delivery**
- **asynchronous optimization**
- **predictable metadata and lifecycle control**

---

# Technology Stack

| Component | Technology |
| --- | --- |
| System of Record | Frappe / ERPNext |
| API Edge Layer | FastAPI |
| Queue / Broker | Redis |
| Workers | Frappe Background Jobs |
| Storage | Cloudflare R2 |
| CDN | Cloudflare CDN |
| Image Processing | Pillow |
| Video Processing | FFmpeg |
| Hashing | SHA256 |

---

# Canonical Data Model

## New primary DocType: `Media Asset`

This becomes the single source of truth for all public media.

## Required fields

### Identity

- `media_id`
- `restaurant`
- `owner_doctype`
- `owner_name`
- `media_role`
- `media_kind`

### Source metadata

- `source_filename`
- `source_extension`
- `source_mime_type`
- `source_size_bytes`
- `source_sha256`

### Storage metadata

- `storage_provider`
- `bucket_name`
- `raw_object_key`
- `primary_object_key`
- `cdn_base_url`
- `primary_url`

### Processing / state

- `status`
- `processing_attempts`
- `last_error`
- `processed_at`
- `is_active`
- `is_deleted`

### Render metadata

- `width`
- `height`
- `duration_seconds`
- `poster_url`
- `blur_placeholder`
- `alt_text`
- `caption`
- `display_order`

## Required `status` values

- `pending_upload`
- `uploaded`
- `processing`
- `ready`
- `failed`
- `deleted`

## Child table: `Media Variant`

Each `Media Asset` can have multiple variants.

### Required fields

- `variant_name`
- `object_key`
- `file_url`
- `format`
- `width`
- `height`
- `size_bytes`
- `quality`
- `is_primary`

---

# Media Roles

Supported `media_role` values should be explicit.

## Product roles

- `product_image`
- `product_video`
- `product_video_poster`

## Restaurant roles

- `restaurant_logo`
- `restaurant_hero_video`
- `restaurant_banner`
- `restaurant_gallery_image`

## Config / branding roles

- `restaurant_config_logo`
- `apple_touch_icon`

Explicit roles reduce ambiguity and simplify validation, processing, and frontend rendering.

---

# How This Maps to Existing Doctypes

## `Menu Product`

Current state:

- `product_media` child table exists and is used by UI and validation logic

Target state:

- `Media Asset` becomes canonical storage for product media
- `product_media` becomes a compatibility layer during migration
- product APIs should eventually serialize media from `Media Asset`, not raw file URLs

## `Restaurant`

Current state:

- `logo` and `hero_video` are plain attachment fields

Target state:

- these become convenience mirrors only if needed
- canonical source becomes linked `Media Asset` records

## `Restaurant Config`

Current state:

- `logo`, `hero_video`, `apple_touch_icon` are attachment fields

Target state:

- move public media handling to `Media Asset`
- keep legacy fields only for temporary backward compatibility

---

# Storage Buckets

Environment separation:

```text
dinematters-dev
dinematters-staging
dinematters-prod
```

Each environment must use:

- separate credentials where possible
- separate bucket or strict key namespace isolation
- separate CDN hostnames or environment prefixes if needed

---

# Storage Key Strategy

## Rule: object keys must be immutable

Do **not** overwrite a stable key like:

```text
restaurants/123/banner.webp
```

That causes CDN staleness and purge dependence.

## Recommended object key format

```text
{env}/restaurants/{restaurant_id}/{owner_doctype}/{owner_name}/{media_role}/{media_id}/raw/{original_filename}
{env}/restaurants/{restaurant_id}/{owner_doctype}/{owner_name}/{media_role}/{media_id}/variants/{variant_name}.{ext}
```

Example:

```text
prod/restaurants/rest_123/Menu Product/burger-deluxe/product_image/med_abc123/raw/burger.jpg
prod/restaurants/rest_123/Menu Product/burger-deluxe/product_image/med_abc123/variants/md.webp
prod/restaurants/rest_123/Menu Product/burger-deluxe/product_image/med_abc123/variants/thumb.webp
```

## Why this is mandatory

- cache-safe
- easy rollback
- easy audit
- no accidental overwrites
- simplified cleanup

---

# Upload Flow

## Step 1 — Request Upload Session

Frontend calls:

```text
POST /api/media/upload-session
```

Request:

```json
{
  "owner_doctype": "Menu Product",
  "owner_name": "burger-deluxe",
  "media_role": "product_image",
  "filename": "burger.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 421337
}
```

Backend responsibilities:

- validate authenticated user
- validate restaurant ownership
- validate owner document exists
- validate allowed role for owner doctype
- validate file type and size
- generate signed upload URL for R2
- create temporary upload session record if needed

Response:

```json
{
  "upload_id": "upl_123",
  "object_key": "prod/restaurants/rest_123/Menu Product/burger-deluxe/product_image/med_abc123/raw/burger.jpg",
  "upload_url": "https://...",
  "headers": {
    "Content-Type": "image/jpeg"
  },
  "expires_in": 600
}
```

---

## Step 2 — Upload Directly to R2

Frontend uploads file directly to R2.

Server load:

```text
near-zero
```

Important rules:

- upload URL must expire quickly
- object key must be pre-authorized by backend
- content type and file size must be bounded

---

## Step 3 — Confirm Upload

Frontend calls:

```text
POST /api/media/confirm-upload
```

Backend responsibilities:

- verify object exists in R2
- verify size and metadata
- create `Media Asset`
- set status to `uploaded`
- enqueue processing job

This endpoint must be **idempotent**.

If frontend retries, it must not create duplicate media assets or duplicate processing jobs.

---

# Processing Queue

Use **Frappe background jobs** first.

```python
frappe.enqueue("dinematters.dinematters.media.jobs.process_media_asset", media_asset_name)
```

## Worker responsibilities

- download raw object from R2
- validate source again
- generate image or video outputs
- upload processed variants back to R2
- update `Media Variant` rows
- set final status
- cleanup temp files

## Worker rules

- must be idempotent
- must be retryable
- must not mark asset ready too early
- must record detailed failure state

---

# Image Processing Pipeline

## Allowed input types

```text
image/jpeg
image/png
image/webp
```

## Initial max upload size

```text
5MB
```

## Processing steps

```text
1. validate MIME type
2. normalize orientation
3. strip metadata
4. resize per media role
5. convert to WebP
6. compress
7. generate variants
8. generate tiny placeholder
```

## Recommended variants

| Variant | Size |
| --- | --- |
| `thumb` | 64px - 120px |
| `sm` | 400px |
| `md` | 800px |
| `lg` | 1200px |
| `xl` | 1600px |

## Recommended role targets

| Role | Primary target |
| --- | --- |
| Restaurant Logo | 512px |
| Restaurant Banner / Hero | 1600px |
| Product Image | 800px |
| Gallery Image | 1200px |

## Compression targets

- product images: `80KB - 180KB`
- hero/banner images: `150KB - 300KB`
- tiny placeholder: `<20KB`

---

# Video Processing Pipeline

## Allowed input types

```text
video/mp4
video/quicktime
```

## Initial max upload size

```text
100MB
```

## Phase 1 output

Generate:

- normalized MP4 at `720p`
- poster image in WebP

This is the best starting point for cost and simplicity.

## Why not HLS immediately?

Dinematters is a restaurant platform, not a long-form video product.

Starting with:

- one optimized MP4 variant
- one poster image

is faster to ship, cheaper to operate, and sufficient for menu / branding videos.

## Future phase

Upgrade to HLS only if video usage becomes central.

---

# CDN Delivery

All public media should be delivered through:

```text
https://cdn.dinematters.com
```

Examples:

```text
https://cdn.dinematters.com/prod/restaurants/rest_123/Menu Product/burger-deluxe/product_image/med_abc123/variants/md.webp
https://cdn.dinematters.com/prod/restaurants/rest_123/Restaurant/my-restaurant/restaurant_logo/med_xyz789/variants/lg.webp
```

## Required cache policy

```text
Cache-Control: public, max-age=31536000, immutable
```

This is safe only because object keys are immutable.

---

# Frontend Rendering Strategy

## Image rendering

Frontend should progressively render:

```text
tiny placeholder
-> thumb
-> final display size
```

## Video rendering

Frontend should first show:

- poster image
- play affordance

then load optimized MP4 on interaction or viewport entry depending on page context.

## Product media component target shape

Current component stores raw URL strings.

Target UI model should support:

```json
{
  "media_id": "med_abc123",
  "media_type": "image",
  "status": "ready",
  "primary_url": "https://cdn...",
  "thumbnail_url": "https://cdn...",
  "poster_url": null,
  "alt_text": "Burger with fries",
  "caption": "Best seller",
  "display_order": 1
}
```

Required UI states:

- uploading
- uploaded
- processing
- ready
- failed

---

# API Output Design

Current product API returns a simple list of URLs.

Target API should return structured media objects.

Example:

```json
"media": [
  {
    "id": "med_abc123",
    "type": "image",
    "url": "https://cdn.../md.webp",
    "thumbnailUrl": "https://cdn.../thumb.webp",
    "altText": "Burger with fries",
    "caption": "Best seller",
    "displayOrder": 1,
    "width": 800,
    "height": 600
  },
  {
    "id": "med_xyz456",
    "type": "video",
    "url": "https://cdn.../video_720.mp4",
    "posterUrl": "https://cdn.../poster.webp",
    "displayOrder": 2,
    "durationSeconds": 8
  }
]
```

This is better for:

- responsive rendering
- accessibility
- video preview support
- migration safety

---

# Permissions and Tenancy

Every media operation must validate:

- authenticated user
- restaurant access
- target document ownership
- allowed media role for the document type

## Mandatory invariant

Every `Media Asset` must store explicit `restaurant` ownership even if the linked owner document already implies it.

This improves:

- multi-tenant safety
- quota tracking
- cleanup
- reporting

## Example permission rules

- user may upload `product_image` only for a `Menu Product` in their restaurant
- user may upload `restaurant_logo` only for a restaurant they can manage
- user may not attach media to another restaurant by guessing IDs

---

# Validation Rules

## Upload-time validation

- MIME allowlist
- file size limit
- owner doctype allowlist
- media role allowlist
- filename sanitization
- signed upload expiry

## Confirm-time validation

- object exists in expected bucket
- object key matches authorized namespace
- content length matches constraints
- owner still exists and is valid

## Process-time validation

- source is readable
- decoder can parse the file
- output variants successfully generated

---

# Security

## Bucket rules

- disable public listing
- do not expose raw bucket URLs to clients
- serve public media through CDN hostname
- restrict write operations to signed uploads only

## Allowed MIME types

```text
image/jpeg
image/png
image/webp
video/mp4
video/quicktime
```

## Explicitly blocked

```text
application/x-msdownload
application/javascript
application/x-php
text/x-shellscript
```

## Rate limiting

Initial upload/session limits:

```text
10 uploads per minute per user
100 media API requests per minute per user
1000 requests per minute per IP
```

---

# Reliability Requirements

## Processing must be idempotent

Re-running the same processing job must not corrupt state.

## Confirm upload must be idempotent

If frontend retries after a network failure, backend must not create duplicate records.

## Deletion must be safe

Delete flow should be:

```text
1. mark asset deleted in DB
2. remove from API visibility
3. enqueue async storage cleanup
```

## Failure recording

On processing failure store:

- failure reason
- failure timestamp
- retry count

---

# Cost Optimization Strategy

To stay low cost while remaining fast:

- use Cloudflare R2 for object storage
- use CDN for all public delivery
- generate only necessary image variants
- start with one normalized video output
- do not introduce HLS initially
- use immutable cacheable URLs
- process asynchronously
- avoid backend file streaming

## Do not implement on day 1

- global deduplication across all media
- HLS transcoding
- AI tagging
- AVIF pipeline

These are useful later but not necessary for launch.

---

# Migration Strategy

The architecture must be adopted without breaking current product or restaurant media flows.

## Phase 1 — Foundation

- add `Media Asset` DocType
- add `Media Variant` child table
- add R2 configuration
- add signed upload session API
- add confirm upload API
- add background processing job
- add CDN URL generation

## Phase 2 — Product Media Migration

- update frontend media upload flow for `Menu Product`
- store new uploads in `Media Asset`
- serialize product media from `Media Asset`
- keep `product_media` child table readable during transition if needed

## Phase 3 — Restaurant Media Migration

- move `logo`, `hero_video`, and related branding media to `Media Asset`
- keep old fields only as temporary mirrors

## Phase 4 — Cleanup

- stop using direct Frappe attachment upload for public media
- remove legacy code paths after validation

---

# FastAPI Integration Rules

FastAPI already exists in the codebase as a thin proxy layer.

For media, FastAPI should remain thin as well.

## FastAPI should do

- authentication
- rate limiting
- request validation
- call Frappe media APIs or internal services

## FastAPI should not do

- business permission logic duplication
- media metadata ownership logic duplication
- processing workflow duplication

Frappe remains the final authority for media ownership and lifecycle.

---

# Operational Requirements

Track these metrics from day 1:

- upload success rate
- upload failure rate
- processing success rate
- processing queue depth
- average processing duration
- media API latency
- CDN hit ratio
- storage growth by restaurant

These are required for production reliability and cost control.

---

# Performance Targets

## Public image delivery

- CDN cache hit latency target: `20ms - 80ms` typical
- optimized image display: visually instant with placeholder strategy

## Video startup

- target: `150ms - 500ms` depending on region and network

## Application server load

- upload transfer load should be near zero because files bypass app servers

---

# What Makes This a Real 10/10 Architecture

This design is 10/10 for Dinematters because it is:

- **built for the current codebase, not a greenfield fantasy**
- **fast for public media delivery**
- **reliable under retries and failures**
- **cheap because storage and delivery are offloaded correctly**
- **incrementally adoptable**
- **multi-tenant safe**
- **ready for products, restaurant branding, and future galleries**

---

# Final Summary

```text
Frontend / Mobile
  -> FastAPI media session endpoint
  -> direct upload to Cloudflare R2
  -> confirm upload
  -> Frappe creates Media Asset
  -> Frappe background worker processes
  -> variants stored in R2
  -> Cloudflare CDN serves immutable URLs
  -> frontend renders structured media objects
```

This is the recommended final architecture for Dinematters media.

It is the best combination of:

- speed
- reliability
- scalability
- migration safety
- low cost

