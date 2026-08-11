ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS stock_name text,
  ADD COLUMN IF NOT EXISTS minimum_boxes integer;
