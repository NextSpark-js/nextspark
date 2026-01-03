-- Migration: 001_better_auth_and_functions.sql
-- Description: Extensiones y funciones de identidad para Better Auth
-- Date: 2025-01-19

-- Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función: obtener el user_id del contexto de app (GUC)
-- Better Auth usa TEXT para IDs, retornamos TEXT
CREATE OR REPLACE FUNCTION public.get_auth_user_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v TEXT;
BEGIN
  v := current_setting('app.user_id', true);
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;

-- Alias sin schema si lo usás en policies legadas
CREATE OR REPLACE FUNCTION get_auth_user_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.get_auth_user_id();
END;
$$;

-- Utilidad: updatedAt (si no existe ya en otra migration)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

-- Function to sync name field with firstName + lastName
CREATE OR REPLACE FUNCTION sync_user_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Set name as firstName + lastName, handling null values
  NEW."name" = COALESCE(
    CASE 
      WHEN NEW."firstName" IS NOT NULL AND NEW."lastName" IS NOT NULL 
      THEN NEW."firstName" || ' ' || NEW."lastName"
      WHEN NEW."firstName" IS NOT NULL 
      THEN NEW."firstName"
      WHEN NEW."lastName" IS NOT NULL 
      THEN NEW."lastName"
      ELSE ''
    END,
    ''
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;