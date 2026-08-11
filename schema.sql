CREATE TABLE IF NOT EXISTS customerorder (
  order_id serial PRIMARY KEY,
  price numeric NOT NULL,
  employee_id integer,
  order_date date,
  order_time time,
  is_in_process boolean DEFAULT TRUE,
  status text
);

CREATE TABLE IF NOT EXISTS container (
  container_id serial PRIMARY KEY,
  container_name text NOT NULL,
  container_price numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS containerimage (
  container_id serial PRIMARY KEY,
  container_name text NOT NULL UNIQUE,
  description text,
  price numeric NOT NULL,
  image text
);

CREATE TABLE IF NOT EXISTS complaints (
  complaint_id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  complaint_text text NOT NULL,
  date date NOT NULL
);

CREATE TABLE IF NOT EXISTS orderxcontainer (
  order_id integer NOT NULL REFERENCES customerorder(order_id),
  container_id integer NOT NULL REFERENCES container(container_id),
  PRIMARY KEY (order_id, container_id)
);

CREATE TABLE IF NOT EXISTS containerxfood (
  container_id integer NOT NULL REFERENCES container(container_id),
  food_id integer NOT NULL,
  PRIMARY KEY (container_id, food_id)
);

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

CREATE TABLE IF NOT EXISTS stock (
  stock_id serial PRIMARY KEY,
  stock_name text,
  total_portions integer NOT NULL,
  boxes integer NOT NULL,
  minimum_boxes integer
);

CREATE TABLE IF NOT EXISTS foodxstock (
  food_id integer NOT NULL REFERENCES food(food_id),
  stock_id integer NOT NULL REFERENCES stock(stock_id),
  PRIMARY KEY (food_id, stock_id)
);