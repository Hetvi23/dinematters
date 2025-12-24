-- SQL Query: Get list of categories where products don't have product_media
-- This query finds Menu Categories that have products without any Product Media entries

-- Version 1: With product count per category
SELECT DISTINCT 
    mp.category,
    mc.category_name,
    COUNT(DISTINCT mp.name) as products_without_media
FROM `tabMenu Product` mp
LEFT JOIN `tabMenu Category` mc ON mp.category = mc.name
LEFT JOIN `tabProduct Media` pm ON pm.parent = mp.name 
    AND pm.parenttype = 'Menu Product'
WHERE mp.category IS NOT NULL
    AND pm.name IS NULL
GROUP BY mp.category, mc.category_name
ORDER BY products_without_media DESC;

-- Version 2: Simple list of categories (without count)
SELECT DISTINCT 
    mp.category,
    mc.category_name
FROM `tabMenu Product` mp
LEFT JOIN `tabMenu Category` mc ON mp.category = mc.name
LEFT JOIN `tabProduct Media` pm ON pm.parent = mp.name 
    AND pm.parenttype = 'Menu Product'
WHERE mp.category IS NOT NULL
    AND pm.name IS NULL
ORDER BY mc.category_name;

-- Version 3: Categories with list of products without media
SELECT 
    mp.category,
    mc.category_name,
    GROUP_CONCAT(mp.product_name ORDER BY mp.product_name SEPARATOR ', ') as products_without_media
FROM `tabMenu Product` mp
LEFT JOIN `tabMenu Category` mc ON mp.category = mc.name
LEFT JOIN `tabProduct Media` pm ON pm.parent = mp.name 
    AND pm.parenttype = 'Menu Product'
WHERE mp.category IS NOT NULL
    AND pm.name IS NULL
GROUP BY mp.category, mc.category_name
ORDER BY mc.category_name;

-- Version 4: Filter by restaurant (if needed)
SELECT DISTINCT 
    mp.category,
    mc.category_name,
    mp.restaurant,
    COUNT(DISTINCT mp.name) as products_without_media
FROM `tabMenu Product` mp
LEFT JOIN `tabMenu Category` mc ON mp.category = mc.name
LEFT JOIN `tabProduct Media` pm ON pm.parent = mp.name 
    AND pm.parenttype = 'Menu Product'
WHERE mp.category IS NOT NULL
    AND pm.name IS NULL
    AND mp.restaurant = 'your-restaurant-id'  -- Replace with actual restaurant ID
GROUP BY mp.category, mc.category_name, mp.restaurant
ORDER BY products_without_media DESC;



