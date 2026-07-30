-- JESI-COSMETIC — add real stock quantity tracking
-- Run after your existing schema files:
-- mysql -u root -p jesi_cosmetic < db/schema_stock_addition.sql

USE jesi_cosmetic;

ALTER TABLE products
  ADD COLUMN stock_quantity INT NOT NULL DEFAULT 50 AFTER in_stock;

-- Keep in_stock consistent with the new quantity column for any existing rows
-- (in_stock stays as a fast filter column; stock_quantity is now the source of truth)
UPDATE products SET in_stock = IF(stock_quantity > 0, 1, 0);
