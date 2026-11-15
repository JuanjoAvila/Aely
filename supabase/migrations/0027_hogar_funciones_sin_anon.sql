-- ============================================================
-- Aely — Las funciones de Hogar no se ejecutan como `anon` (14/11/2026, auditoría P3).
--
-- 0013/0014/0015/0022 hacen `revoke all … from public` y `grant execute … to authenticated`.
-- En Supabase eso no basta: los privilegios por defecto del esquema dan EXECUTE EXPLÍCITO a
-- `anon` en cada función nueva, y un `revoke … from public` no toca un grant explícito. Hoy no
-- tiene efecto (las dos comprueban `auth.uid()`, que sin sesión es null), pero una función
-- SECURITY DEFINER que nadie sin sesión necesita no debe quedar a un `rpc` de distancia.
-- Las políticas de Hogar son `to authenticated`, así que ninguna consulta de `anon` las evalúa.
-- Idempotente. Se aplica a mano o con `migraciones=si`; no la necesita ninguna función nueva.
-- ============================================================

revoke execute on function public.join_household_by_code(text) from anon;
revoke execute on function public.is_household_member(uuid) from anon;
