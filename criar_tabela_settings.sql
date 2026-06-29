-- ============================================================
-- Tabela de configurações globais do dashboard Restart Intestinal
-- Roda no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.touch_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_settings_updated_at();

-- Habilitar RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policies para usuário anon (dashboard interno sem autenticação)
CREATE POLICY "settings_select" ON public.settings
  FOR SELECT TO anon USING (true);

CREATE POLICY "settings_insert" ON public.settings
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "settings_update" ON public.settings
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "settings_delete" ON public.settings
  FOR DELETE TO anon USING (true);
