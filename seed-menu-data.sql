-- =========================================================
-- Panda Express Menu Seed Data
-- Seeds the `food`, `stock`, and `foodxstock` tables with
-- real Panda Express menu items, descriptions, and calories
-- so the app is fully usable end-to-end (cashier, kitchen,
-- display boards, menu editing, inventory) without needing
-- to manually create items first.
--
-- Run AFTER schema.sql, food.sql, create-stock.sql, and
-- seed-containers.sql have already been applied.
-- =========================================================

-- ---------------------------------------------------------
-- FOOD ITEMS
-- itemtype values used by the app: 'entree', 'side',
-- 'appetizer', 'drink'
-- ---------------------------------------------------------
INSERT INTO food (food_id, food_name, description, itemtype, calories, seasonal, dietary_restrictions, image) VALUES
  -- Entrees
  (1,  'Orange Chicken',            'Crispy chicken wok-tossed in a sweet and spicy orange sauce.',                     'entree',    490, false, NULL,                       'https://placehold.co/300x200?text=Orange+Chicken'),
  (2,  'Beijing Beef',              'Crispy beef, bell peppers, and onions in a sweet-tangy sauce.',                    'entree',    480, false, NULL,                       'https://placehold.co/300x200?text=Beijing+Beef'),
  (3,  'Broccoli Beef',             'Tender beef and fresh broccoli in a ginger soy sauce.',                            'entree',    150, false, 'Gluten-Free',              'https://placehold.co/300x200?text=Broccoli+Beef'),
  (4,  'Kung Pao Chicken',          'Chicken with peanuts, vegetables, and chili peppers in a savory sauce.',           'entree',    290, false, NULL,                       'https://placehold.co/300x200?text=Kung+Pao+Chicken'),
  (5,  'Honey Walnut Shrimp',       'Crispy shrimp tossed in a honey sauce and topped with glazed walnuts.',            'entree',    360, false, NULL,                       'https://placehold.co/300x200?text=Honey+Walnut+Shrimp'),
  (6,  'Grilled Teriyaki Chicken',  'Grilled chicken thigh in a sweet teriyaki sauce.',                                 'entree',    275, false, 'Gluten-Free',              'https://placehold.co/300x200?text=Teriyaki+Chicken'),
  (7,  'Black Pepper Chicken',      'Chicken breast, celery, and onions in a bold black pepper sauce.',                 'entree',    280, false, NULL,                       'https://placehold.co/300x200?text=Black+Pepper+Chicken'),
  (8,  'Mushroom Chicken',          'Chicken breast with mushrooms and zucchini in a ginger soy sauce.',                'entree',    220, false, NULL,                       'https://placehold.co/300x200?text=Mushroom+Chicken'),
  (9,  'String Bean Chicken Breast','Chicken breast with string beans in a mild ginger soy sauce.',                     'entree',    210, false, NULL,                       'https://placehold.co/300x200?text=String+Bean+Chicken'),
  (10, 'SweetFire Chicken Breast',  'Crispy chicken in a sweet, tangy, mildly spicy sauce with peppers and pineapple.', 'entree',    380, false, NULL,                       'https://placehold.co/300x200?text=SweetFire+Chicken'),

  -- Sides
  (11, 'Chow Mein',                 'Stir-fried wheat noodles with onions, celery, and cabbage.',                      'side',      510, false, NULL,                       'https://placehold.co/300x200?text=Chow+Mein'),
  (12, 'Fried Rice',                'Steamed rice wok-tossed with soy sauce, egg, peas, carrots, and green onions.',   'side',      520, false, NULL,                       'https://placehold.co/300x200?text=Fried+Rice'),
  (13, 'White Steamed Rice',        'Steamed white rice.',                                                              'side',      380, false, 'Vegan, Gluten-Free',      'https://placehold.co/300x200?text=White+Rice'),
  (14, 'Super Greens',              'Broccoli, kale, and cabbage wok-tossed in a garlic sauce.',                       'side',      130, false, 'Vegan, Gluten-Free',      'https://placehold.co/300x200?text=Super+Greens'),

  -- Appetizers
  (15, 'Chicken Egg Roll',          'Cabbage, carrots, and chicken wrapped in a crispy wonton wrapper.',               'appetizer', 200, false, NULL,                       'https://placehold.co/300x200?text=Chicken+Egg+Roll'),
  (16, 'Veggie Spring Roll',        'Cabbage, celery, and carrots wrapped in a crispy spring roll wrapper.',           'appetizer', 160, false, 'Vegetarian',               'https://placehold.co/300x200?text=Veggie+Spring+Roll'),
  (17, 'Cream Cheese Rangoon',      'Cream cheese and green onion wrapped in a crispy wonton wrapper.',                'appetizer', 190, false, 'Vegetarian',               'https://placehold.co/300x200?text=Cream+Cheese+Rangoon'),
  (18, 'Apple Pie Roll',            'Spiced apples wrapped in a crispy roll, dusted with cinnamon sugar.',             'appetizer', 150, false, 'Vegetarian',               'https://placehold.co/300x200?text=Apple+Pie+Roll'),

  -- Drinks
  (19, 'Fountain Drink',            'Your choice of Coca-Cola, Sprite, Dr Pepper, or other fountain beverage.',        'drink',     150, false, NULL,                       'https://placehold.co/300x200?text=Fountain+Drink'),
  (20, 'Bottled Water',             'Bottled water.',                                                                   'drink',       0, false, 'Vegan, Gluten-Free',      'https://placehold.co/300x200?text=Bottled+Water'),
  (21, 'Gatorade',                  'Bottled Gatorade sports drink.',                                                   'drink',      80, false, 'Gluten-Free',              'https://placehold.co/300x200?text=Gatorade')
ON CONFLICT (food_id) DO UPDATE SET
  food_name             = EXCLUDED.food_name,
  description            = EXCLUDED.description,
  itemtype               = EXCLUDED.itemtype,
  calories                = EXCLUDED.calories,
  seasonal                = EXCLUDED.seasonal,
  dietary_restrictions    = EXCLUDED.dietary_restrictions,
  image                    = EXCLUDED.image;

-- Keep the food_id sequence in sync after explicit-ID inserts
SELECT setval(pg_get_serial_sequence('food', 'food_id'), (SELECT MAX(food_id) FROM food));

-- ---------------------------------------------------------
-- STOCK (one stock record per menu item, so every item can
-- be tracked for inventory / in-stock status)
-- ---------------------------------------------------------
INSERT INTO stock (stock_id, stock_name, total_portions, boxes, minimum_boxes) VALUES
  (1,  'Orange Chicken',             50, 5, 2),
  (2,  'Beijing Beef',               50, 5, 2),
  (3,  'Broccoli Beef',              50, 5, 2),
  (4,  'Kung Pao Chicken',           50, 5, 2),
  (5,  'Honey Walnut Shrimp',        40, 4, 2),
  (6,  'Grilled Teriyaki Chicken',   50, 5, 2),
  (7,  'Black Pepper Chicken',       50, 5, 2),
  (8,  'Mushroom Chicken',           50, 5, 2),
  (9,  'String Bean Chicken Breast', 50, 5, 2),
  (10, 'SweetFire Chicken Breast',   50, 5, 2),
  (11, 'Chow Mein',                  60, 6, 2),
  (12, 'Fried Rice',                 60, 6, 2),
  (13, 'White Steamed Rice',         60, 6, 2),
  (14, 'Super Greens',               40, 4, 2),
  (15, 'Chicken Egg Roll',           80, 4, 2),
  (16, 'Veggie Spring Roll',         80, 4, 2),
  (17, 'Cream Cheese Rangoon',       80, 4, 2),
  (18, 'Apple Pie Roll',             80, 4, 2),
  (19, 'Fountain Drink',            200, 1, 1),
  (20, 'Bottled Water',             100, 5, 2),
  (21, 'Gatorade',                  100, 5, 2)
ON CONFLICT (stock_id) DO UPDATE SET
  stock_name       = EXCLUDED.stock_name,
  total_portions    = EXCLUDED.total_portions,
  boxes              = EXCLUDED.boxes,
  minimum_boxes      = EXCLUDED.minimum_boxes;

-- Keep the stock_id sequence in sync after explicit-ID inserts
SELECT setval(pg_get_serial_sequence('stock', 'stock_id'), (SELECT MAX(stock_id) FROM stock));

-- ---------------------------------------------------------
-- FOODXSTOCK (1:1 mapping so checkStock finds a stock
-- record for every menu item)
-- ---------------------------------------------------------
INSERT INTO foodxstock (food_id, stock_id) VALUES
  (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (7, 7), (8, 8), (9, 9), (10, 10),
  (11, 11), (12, 12), (13, 13), (14, 14),
  (15, 15), (16, 16), (17, 17), (18, 18),
  (19, 19), (20, 20), (21, 21)
ON CONFLICT (food_id, stock_id) DO NOTHING;
