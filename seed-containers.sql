INSERT INTO containerimage (container_name, description, price, image) VALUES
  ('Plate', 'Standard plate container', 980, '/images/plate.png'),
  ('Bowl', 'Standard bowl container', 830, '/images/bowl.png'),
  ('Bigger Plate', 'Larger plate', 1130, '/images/bigger_plate.png'),
  ('A-La-Carte', 'Single item', 440, '/images/a_la_carte.png'),
  ('Appetizer', 'Appetizer combo', 200, '/images/appetizer.png'),
  ('Drink', 'Beverage', 210, '/images/drink.png')
ON CONFLICT (container_name) DO NOTHING;

ALTER TABLE customerorder
ADD COLUMN bump_value integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS customerorder (
  order_id serial PRIMARY KEY,
  price numeric NOT NULL,
  employee_id integer,
  order_date date,
  order_time time,
  is_in_process boolean DEFAULT TRUE,
  status text,
  bump_value integer DEFAULT 0
);