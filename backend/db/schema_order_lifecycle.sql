-- JESI-COSMETIC — order lifecycle redesign (corrected order of operations)
-- Run after your existing schema files:
-- mysql -u root -p jesi_cosmetic < db/schema_order_lifecycle.sql

USE jesi_cosmetic;

-- Step 1: widen the enum to include BOTH old and new values first, so the
-- remapping UPDATEs below (which write the new values) aren't rejected
-- while old rows still hold old values.
ALTER TABLE orders
  MODIFY COLUMN status ENUM('pending','processing','shipped','delivered','cancelled',
                             'to_pay','to_receive','to_review','completed')
  NOT NULL DEFAULT 'to_pay';

-- Step 2: remap every existing row onto the new lifecycle.
UPDATE orders SET status = 'to_receive' WHERE status IN ('pending', 'processing');
UPDATE orders SET status = 'to_review'  WHERE status = 'shipped';
UPDATE orders SET status = 'completed'  WHERE status = 'delivered';
-- 'cancelled' already matches the new set, left as-is.

-- Step 3: now that every row uses a new-lifecycle value, narrow the enum
-- down to just the final 5 options.
ALTER TABLE orders
  MODIFY COLUMN status ENUM('to_pay', 'to_receive', 'to_review', 'completed', 'cancelled')
  NOT NULL DEFAULT 'to_pay';

ALTER TABLE orders
  ADD COLUMN rating TINYINT NULL AFTER status;