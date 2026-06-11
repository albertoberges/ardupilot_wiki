-- ============================================================
-- LUGARES DE INTERÉS
-- ============================================================

CREATE TYPE categoria_lugar AS ENUM (
  'ayuntamiento', 'iglesia', 'parque', 'colegio', 'farmacia',
  'polideportivo', 'plaza', 'mercado', 'museo', 'otro'
);

CREATE TABLE lugares_interes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  categoria   categoria_lugar NOT NULL DEFAULT 'otro',
  latitud     DOUBLE PRECISION NOT NULL,
  longitud    DOUBLE PRECISION NOT NULL,
  direccion   TEXT,
  horario     TEXT,
  telefono    TEXT,
  imagen_url  TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lugares_interes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lugares_read_all" ON lugares_interes FOR SELECT USING (activo = TRUE);
CREATE POLICY "lugares_admin_all" ON lugares_interes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'ayuntamiento')
  ));

-- ============================================================
-- DATOS DE EJEMPLO - Villamayor de Gállego (Zaragoza)
-- Ajusta nombres, direcciones y coordenadas exactas a la realidad
-- ============================================================
INSERT INTO lugares_interes (nombre, descripcion, categoria, latitud, longitud, direccion, horario) VALUES
('Ayuntamiento',         'Casa consistorial de Villamayor de Gállego', 'ayuntamiento',  41.7050, -0.8830, 'Plaza del Ayuntamiento, 1', 'L-V 9:00-14:00'),
('Iglesia Parroquial',   'Iglesia principal del municipio',             'iglesia',        41.7055, -0.8825, 'Plaza de la Iglesia s/n',  'Consultar horario de misas'),
('Parque Municipal',     'Parque principal con zonas de juego',         'parque',         41.7045, -0.8840, 'Calle del Parque s/n',     'Todos los días 8:00-22:00'),
('Colegio Público',      'Centro de educación primaria',                'colegio',        41.7060, -0.8820, 'Calle de la Escuela, 5',   'L-V 9:00-17:00'),
('Farmacia',             'Farmacia municipal',                          'farmacia',       41.7048, -0.8835, 'Calle Mayor, 12',          'L-V 9:00-21:00 / S 9:00-14:00'),
('Polideportivo',        'Instalaciones deportivas municipales',        'polideportivo',  41.7038, -0.8850, 'Calle Deportiva s/n',      'L-D 7:00-23:00');
