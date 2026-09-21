NOTIFY pgrst, 'reload schema';

GRANT ALL ON TABLE public.uniform_stock TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.uniforms TO anon, authenticated, service_role;
