-- App users: one profile per Auth account.
-- Roles: admin (all records), supervisor (all functions), user (operations + pedidos only).

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'supervisor', 'user')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), ''),
    NEW.email,
    'user'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.profiles (id, full_name, email, role, active)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), ''),
  u.email,
  'user',
  true
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- First existing account becomes admin if none exists yet.
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT p.id FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = true
$$;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Staff can read profiles" ON profiles;
CREATE POLICY "Staff can read profiles"
  ON profiles FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('admin', 'supervisor'));

DROP POLICY IF EXISTS "Users can update own name" ON profiles;
CREATE POLICY "Users can update own name"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active THEN
    IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Apenas administradores alteram papel ou status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role ON profiles;
CREATE TRIGGER protect_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE public.protect_profile_role();

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
