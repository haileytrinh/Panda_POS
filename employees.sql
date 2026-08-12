CREATE TABLE IF NOT EXISTS employee (
  employee_id text PRIMARY KEY,
  employee_firstname text,
  employee_lastname text,
  email text,
  number text,
  is_manager boolean DEFAULT false,
  orders_taken integer DEFAULT 0
);

DELETE FROM employee WHERE employee_id IN (
  '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',
  '478057859094-e6hs68hro3cb6usdl5ton929m9ho7ff9.apps.googleusercontent.com'
);

INSERT INTO employee (
  employee_id,
  employee_firstname,
  employee_lastname,
  email,
  number,
  is_manager,
  orders_taken
) VALUES (
  '104047781805305503653',
  'Hailey',
  'Trinh',
  'hqtrinhhh@gmail.com',
  '(281) 229-3938',
  true,
  0
)
ON CONFLICT (employee_id) DO UPDATE SET
  employee_firstname = EXCLUDED.employee_firstname,
  employee_lastname = EXCLUDED.employee_lastname,
  email = EXCLUDED.email,
  number = EXCLUDED.number,
  is_manager = EXCLUDED.is_manager,
  orders_taken = EXCLUDED.orders_taken;

SELECT * FROM employee;
