# Dinematters UI - Mint-like Interface

A modern React-based UI for Dinematters, built similar to the Mint app architecture. This UI provides a URL-based navigation system that respects all dinematters permissions and restaurant-based access control.

## Features

- **URL-based Navigation**: Uses React Router for clean, shareable URLs
- **Permission-aware**: Automatically filters data based on user's restaurant permissions
- **Modern UI**: Built with React, TypeScript, Tailwind CSS, and shadcn/ui components
- **Responsive Design**: Works on desktop and mobile devices
- **No Page Dependency**: Works directly via URL routing, not dependent on Frappe pages

## Architecture

The UI follows the same pattern as Mint:
- **Frontend**: React + Vite + TypeScript
- **Routing**: React Router for URL-based navigation
- **Data Fetching**: frappe-react-sdk with automatic permission filtering
- **Styling**: Tailwind CSS with shadcn/ui components

## Setup

### 1. Install Dependencies

```bash
cd apps/dinematters/frontend
yarn install
```

### 2. Development

```bash
yarn dev
```

The app will be available at `http://localhost:8081` and will proxy API requests to your Frappe server.

### 3. Build for Production

```bash
yarn build
```

This will:
- Build the React app
- Output to `dinematters/public/dinematters/`
- Copy the HTML entry point to `dinematters/www/dinematters.html`

## URL Structure

The UI is accessible at `/dinematters` and supports the following routes:

- `/dinematters/` or `/dinematters/dashboard` - Dashboard with overview
- `/dinematters/orders` - List of all orders (filtered by permissions)
- `/dinematters/orders/:orderId` - Order detail page
- `/dinematters/products` - List of all products (filtered by permissions)
- `/dinematters/products/:productId` - Product detail page
- `/dinematters/categories` - List of all categories (filtered by permissions)

## Permissions

All data fetching automatically respects dinematters permission system:

1. **Restaurant-based filtering**: Users only see data from restaurants they have access to
2. **Permission query conditions**: Applied automatically via `permission_query_conditions` in hooks.py
3. **Has permission checks**: Document-level permissions are enforced

The permission system works through:
- `permission_query_conditions` in `hooks.py` - Filters queries at database level
- `has_permission` in `hooks.py` - Checks document-level access
- Restaurant User permissions - Controls which restaurants a user can access

## Components

### Pages
- `Dashboard.tsx` - Overview with stats and recent orders
- `Orders.tsx` - List of orders with filtering
- `OrderDetail.tsx` - Detailed order view
- `Products.tsx` - List of products
- `ProductDetail.tsx` - Detailed product view
- `Categories.tsx` - List of categories

### Layout
- `Layout.tsx` - Main layout with navigation header

### UI Components
- Button, Card, Table, etc. - shadcn/ui components

## Data Fetching

The UI uses `frappe-react-sdk` hooks which automatically:
- Apply permission filters
- Handle loading states
- Cache responses
- Revalidate on focus

Example:
```typescript
const { data: orders, isLoading } = useFrappeGetDocList('Order', {
  fields: ['name', 'status', 'total'],
  limit: 100
})
```

The permission system automatically filters these queries based on the user's restaurant access.

## Configuration

### Hooks Configuration

In `dinematters/hooks.py`:
```python
website_route_rules = [{'from_route': '/dinematters/<path:app_path>', 'to_route': 'dinematters'}]
```

This routes all `/dinematters/*` URLs to the dinematters controller.

### Vite Configuration

The build outputs to `dinematters/public/dinematters/` and the HTML is served from `dinematters/www/dinematters.html`.

## Development Notes

- The UI is completely independent of Frappe pages
- All navigation is URL-based using React Router
- Permissions are enforced at the data layer, not the UI layer
- The UI respects all existing dinematters permission helpers

## Future Enhancements

- Add more pages (Bookings, Events, Games, etc.)
- Add create/edit forms
- Add filters and search
- Add charts and analytics
- Add real-time updates via websockets










