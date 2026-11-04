-- 003: caché sincronizado de SECOP II Contratos Electrónicos (jbjy-vk9h).
-- El contenedor API no alcanza datos.gov.co (TCP filtrado); el host sí.
-- Estrategia: scripts de sync host-side + lectura local (ver PUBLIC_DATA_SOURCES.md).
CREATE TABLE secop_contratos (
  id                         TEXT PRIMARY KEY, -- :id de Socrata
  nombre_entidad             TEXT,
  nit_entidad                TEXT,
  departamento               TEXT,
  ciudad                     TEXT,
  proceso_de_compra          TEXT,
  id_contrato                TEXT,
  referencia_del_contrato    TEXT,
  estado_contrato            TEXT,
  descripcion_del_proceso    TEXT,
  objeto_del_contrato        TEXT,
  tipo_de_contrato           TEXT,
  modalidad_de_contratacion  TEXT,
  fecha_de_firma             TIMESTAMPTZ,
  fecha_de_inicio_del_contrato TIMESTAMPTZ,
  fecha_de_fin_del_contrato  TIMESTAMPTZ,
  proveedor_adjudicado       TEXT,
  documento_proveedor        TEXT,
  valor_del_contrato         NUMERIC,
  valor_facturado            NUMERIC,
  valor_pagado               NUMERIC,
  dias_adicionados           NUMERIC,
  urlproceso                 TEXT,
  ultima_actualizacion       TIMESTAMPTZ,
  synced_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_secop_entidad ON secop_contratos (nombre_entidad);
CREATE INDEX idx_secop_proveedor ON secop_contratos (proveedor_adjudicado);
CREATE INDEX idx_secop_firma ON secop_contratos (fecha_de_firma DESC);
CREATE INDEX idx_secop_valor ON secop_contratos (valor_del_contrato);
