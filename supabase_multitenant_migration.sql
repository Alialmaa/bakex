-- =============================================
-- BAKEX - Multi-tenant Migration
-- Run this in Supabase SQL Editor ONCE
-- =============================================

-- 1. Add status to users (was used in code but missing from schema)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- 2. Bakeries table
CREATE TABLE IF NOT EXISTS bakeries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,  -- short join code e.g. "BAKE42"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add bakery_id to all tables
ALTER TABLE users         ADD COLUMN IF NOT EXISTS bakery_id UUID REFERENCES bakeries(id);
ALTER TABLE stock         ADD COLUMN IF NOT EXISTS bakery_id UUID REFERENCES bakeries(id);
ALTER TABLE recipes       ADD COLUMN IF NOT EXISTS bakery_id UUID REFERENCES bakeries(id);
ALTER TABLE production_log ADD COLUMN IF NOT EXISTS bakery_id UUID REFERENCES bakeries(id);
ALTER TABLE sales         ADD COLUMN IF NOT EXISTS bakery_id UUID REFERENCES bakeries(id);

-- 4. Purchases table (was in API code but missing from schema)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bakery_id UUID REFERENCES bakeries(id),
  material_name TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  pack_weight NUMERIC,
  pack_price NUMERIC,
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Disable RLS on new tables (consistent with existing approach)
ALTER TABLE bakeries DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;

-- 6. Super admin account (bakery_id = null = sees everything)
INSERT INTO users (name, username, password_hash, role, perms, status) VALUES (
  'Super Admin',
  'superadmin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'super_admin',
  '{"dashboard":true,"stock":true,"produce":true,"sales":true,"cost":true,"reports":true,"users":true,"bakeries":true}',
  'active'
) ON CONFLICT (username) DO NOTHING;

-- =============================================
-- OPTIONAL: Migrate existing single-tenant data
-- If you have existing data, assign it to a bakery:
--
-- INSERT INTO bakeries (name, code) VALUES ('البيكري الرئيسية', 'MAIN01');
-- UPDATE users          SET bakery_id = (SELECT id FROM bakeries WHERE code='MAIN01') WHERE bakery_id IS NULL AND role != 'super_admin';
-- UPDATE stock          SET bakery_id = (SELECT id FROM bakeries WHERE code='MAIN01') WHERE bakery_id IS NULL;
-- UPDATE recipes        SET bakery_id = (SELECT id FROM bakeries WHERE code='MAIN01') WHERE bakery_id IS NULL;
-- UPDATE production_log SET bakery_id = (SELECT id FROM bakeries WHERE code='MAIN01') WHERE bakery_id IS NULL;
-- UPDATE sales          SET bakery_id = (SELECT id FROM bakeries WHERE code='MAIN01') WHERE bakery_id IS NULL;
-- =============================================
