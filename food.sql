CREATE TABLE IF NOT EXISTS food (
  food_id serial PRIMARY KEY,
  food_name text NOT NULL,
  description text,
  itemtype text,
  calories integer,
  seasonal boolean,
  dietary_restrictions text,
  image text
);

CREATE TABLE IF NOT EXISTS containerxfood (
  container_id integer NOT NULL REFERENCES container(container_id),
  food_id integer NOT NULL,
  PRIMARY KEY (container_id, food_id)
);

CREATE TABLE IF NOT EXISTS foodxstock (
  food_id integer NOT NULL REFERENCES food(food_id),
  stock_id integer NOT NULL REFERENCES stock(stock_id),
  PRIMARY KEY (food_id, stock_id)
);