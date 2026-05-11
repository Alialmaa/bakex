-- =============================================
-- BAKEX - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', -- admin | manager | staff | readonly
  perms JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock / Inventory table
CREATE TABLE IF NOT EXISTS stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'كجم',
  min_qty NUMERIC NOT NULL DEFAULT 0,
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  output_qty NUMERIC NOT NULL DEFAULT 1,
  output_unit TEXT NOT NULL DEFAULT 'حبة',
  sell_price NUMERIC NOT NULL DEFAULT 0,
  ingredients JSONB NOT NULL DEFAULT '[]',
  -- ingredients format: [{ "material": "دقيق القمح", "amount": 0.5 }]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production log
CREATE TABLE IF NOT EXISTS production_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id),
  recipe_name TEXT,
  output_qty NUMERIC,
  output_unit TEXT,
  produced_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id),
  recipe_name TEXT,
  qty NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  sold_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SEED DATA - Default admin user
-- Password: 1234 (bcrypt hash)
-- =============================================
INSERT INTO users (name, username, password_hash, role, perms) VALUES (
  'المدير العام',
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: "1234"
  'admin',
  '{"dashboard":true,"stock":true,"produce":true,"sales":true,"cost":true,"reports":true,"users":true}'
) ON CONFLICT (username) DO NOTHING;

-- Seed stock
INSERT INTO stock (name, qty, unit, min_qty, price_per_unit) VALUES
  ('دقيق القمح', 45, 'كجم', 50, 3.5),
  ('سكر', 85, 'كجم', 30, 4),
  ('زبدة', 3, 'كجم', 10, 35),
  ('بيض', 60, 'حبة', 30, 1),
  ('حليب', 40, 'لتر', 20, 8),
  ('خميرة', 8, 'كجم', 5, 12),
  ('ملح', 5, 'كجم', 2, 2),
  ('شوكولاتة داكنة', 2, 'كجم', 1, 45)
ON CONFLICT DO NOTHING;

-- Seed recipes
INSERT INTO recipes (name, output_qty, output_unit, sell_price, ingredients) VALUES
  ('خبز البر', 10, 'رغيف', 3, '[{"material":"دقيق القمح","amount":2},{"material":"خميرة","amount":0.05},{"material":"ملح","amount":0.02}]'),
  ('كيكة إسفنجية', 1, 'كيكة', 45, '[{"material":"دقيق القمح","amount":0.3},{"material":"سكر","amount":0.25},{"material":"بيض","amount":5},{"material":"زبدة","amount":0.2}]'),
  ('كرواسان', 12, 'حبة', 5, '[{"material":"دقيق القمح","amount":0.5},{"material":"زبدة","amount":0.3},{"material":"حليب","amount":0.15}]'),
  ('كوكيز شوكولاتة', 24, 'قطعة', 3, '[{"material":"دقيق القمح","amount":0.25},{"material":"سكر","amount":0.18},{"material":"زبدة","amount":0.15},{"material":"بيض","amount":3}]')
ON CONFLICT DO NOTHING;

-- =============================================
-- Row Level Security (RLS) - Optional
-- Disable for simplicity with server-side auth
-- =============================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
