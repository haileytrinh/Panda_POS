CREATE TABLE IF NOT EXISTS employee (
  employee_id text PRIMARY KEY,
  employee_firstname text,
  employee_lastname text,
  email text,
  number text,
  is_manager boolean DEFAULT false,
  orders_taken integer DEFAULT 0
);

ON CONFLICT (employee_id) DO UPDATE SET
  employee_firstname = EXCLUDED.employee_firstname,
  employee_lastname = EXCLUDED.employee_lastname,
  email = EXCLUDED.email,
  number = EXCLUDED.number,
  is_manager = EXCLUDED.is_manager,
  orders_taken = EXCLUDED.orders_taken;

SELECT * FROM employee;
