INSERT INTO containerimage (container_name, description, price, image) VALUES
  ('Plate', 'Standard plate container', 980, '/images/plate.png'),
  ('Bowl', 'Standard bowl container', 830, '/images/bowl.png'),
  ('Bigger Plate', 'Larger plate', 1130, '/images/bigger_plate.png'),
  ('A-La-Carte', 'Single item', 440, '/images/a_la_carte.png'),
  ('Appetizer', 'Appetizer combo', 200, '/images/appetizer.png'),
  ('Drink', 'Beverage', 210, '/images/drink.png')
ON CONFLICT (container_name) DO NOTHING;