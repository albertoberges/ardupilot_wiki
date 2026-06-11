-- ============================================================
-- MIGRATION 003: New roles, access codes, org names
-- ============================================================

-- Add new roles to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'asociacion';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'empresa';

-- Add nombre_organizacion to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nombre_organizacion TEXT;

-- Update trigger to save role and org name from metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    INSERT INTO profiles (id, email, nombre, apellidos, role, nombre_organizacion)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario'),
      COALESCE(NEW.raw_user_meta_data->>'apellidos', ''),
      COALESCE(NEW.raw_user_meta_data->>'role', 'ciudadano')::user_role,
      NEW.raw_user_meta_data->>'nombre_organizacion'
    ) ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

-- ============================================================
-- CODIGOS DE ACCESO
-- ============================================================
CREATE TABLE IF NOT EXISTS codigos_acceso (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo     TEXT NOT NULL UNIQUE,
  role       user_role NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  usos       INTEGER NOT NULL DEFAULT 0,
  max_usos   INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE codigos_acceso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "codigos_admin_all" ON codigos_acceso FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ayuntamiento')));

-- Function to validate access code (accessible by anon for registration)
CREATE OR REPLACE FUNCTION validar_codigo(p_codigo TEXT, p_role TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT TRUE INTO v_valid
  FROM codigos_acceso
  WHERE codigo = UPPER(p_codigo)
    AND role = p_role::user_role
    AND activo = TRUE
    AND (max_usos IS NULL OR usos < max_usos);

  IF v_valid THEN
    UPDATE codigos_acceso SET usos = usos + 1 WHERE codigo = UPPER(p_codigo);
  END IF;

  RETURN COALESCE(v_valid, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION validar_codigo(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validar_codigo(TEXT, TEXT) TO authenticated;

-- ============================================================
-- UPDATE NOTICIAS POLICIES: allow asociacion/empresa to publish
-- ============================================================
DROP POLICY IF EXISTS "noticias_admin_all" ON noticias;
CREATE POLICY "noticias_admin_all" ON noticias FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'ayuntamiento', 'asociacion', 'empresa')
  ));

-- ============================================================
-- DEFAULT ACCESS CODES
-- Change these to real secure codes before going live!
-- ============================================================
INSERT INTO codigos_acceso (codigo, role) VALUES
  ('ASOC2024', 'asociacion'),
  ('EMP2024',  'empresa'),
  ('AYTO2024', 'ayuntamiento')
ON CONFLICT (codigo) DO NOTHING;
