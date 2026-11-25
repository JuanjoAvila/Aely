-- ============================================================
-- Aely — DIN-07 (FIN-29/30 R4): lápidas GLOBALES de renombres hechos con versiones <= 4.26.190.
--
-- Qué pasaba: renombrar un movimiento del banco dejaba en `app_state.data.deleted` una lápida con la
-- clave del nombre ORIGINAL (`día|importe|nombre-del-banco`), sin cuenta. No era un borrado, era la
-- huella de un alias; pero esa clave escondía también a la OTRA cuenta con el mismo cargo (Sabadell +
-- CaixaBank 3,20 € cada uno: 640 esperados, 320 vistos) tanto en la app como en el widget/ingest
-- (`filasComoLaApp`). La 4.26.191 dejó de escribirlas; las ya escritas siguen en la nube.
--
-- Qué hace esta migración (idempotente, se puede lanzar las veces que haga falta):
--   1. Índice parcial `expenses_renombradas_idx`: solo las filas de banco cuyo nombre actual difiere
--      del bancario (`ob_name <> comercio`). Ayuda a localizar las filas renombradas por usuario (el origen de cada candidata).
--   2. Tabla `lapidas_renombre_log`: qué lápida se levantó, a quién y cuándo. Sin políticas RLS:
--      solo service_role. Permite devolverla si algún día hiciera falta.
--   3. Función `lapidas_renombre_viejas(p_user)`: por cada usuario, una lápida global de `deleted` se LEVANTA
--      solo si esconde AHORA a una fila viva de OTRA cuenta conocida (banco+cuenta distintos de los de la
--      fila renombrada cuyo `ob_name` produce esa clave). Sale de `deleted` y entra en `deletedAt` con una
--      hora posterior (regla de `unionPorHora`). Sin fila escondida no se toca nada: borrar una fila sin
--      identidad completa escribía la MISMA clave que un renombre, y un borrado real no se resucita.
--   4. NO la ejecuta: se lanza a mano tras medir con el dry-run.
--
-- Espejo de `lapidasRenombreViejas` (src/modules/00-core.js): clave = día UTC | importe sin ceros de cola |
-- nombre [| #ordinal si el source lleva `#nK`, K>1]. Solo filas `ob:` y `ob-hist:`. El cliente repite la
-- comprobación en cada pasada (sin marcador de «hecho»), así que un móvil viejo que devuelva la lápida
-- la vuelve a ver levantada: ver `lapidasRenombreMigra`.
--
-- NO la aplica ningún agente: la lanza el dueño/coordinador desde el SQL Editor (docs/SETUP-SUPABASE.md,
-- «Migración 0032»). Medir antes: `select * from public.lapidas_renombre_viejas_dryrun();`
-- ============================================================

create index if not exists expenses_renombradas_idx
  on public.expenses (user_id)
  where ob_name is not null and ob_name is distinct from comercio
    and (source like 'ob:%' or source like 'ob-hist:%');

create table if not exists public.lapidas_renombre_log (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  clave        text not null,
  levantada_ms bigint not null,
  created_at   timestamptz not null default now()
);
alter table public.lapidas_renombre_log enable row level security;
revoke all on table public.lapidas_renombre_log from public, anon, authenticated;
grant select, insert on table public.lapidas_renombre_log to service_role;

-- Claves de lápida global que ESCONDEN ahora mismo la otra cuenta: hay una fila viva renombrada (r) y otra
-- fila viva (o) de una cuenta conocida DISTINTA cuya clave es justo esa lápida. Sin esa prueba no se toca
-- nada: borrar una fila sin identidad completa escribía la misma clave y no se puede distinguir de un renombre.
create or replace function public.lapidas_renombre_claves(p_user uuid)
returns text[]
language sql
stable
set search_path = public, pg_temp
as $fn$
  with filas as (
    select e.comercio, e.ob_name,
           to_char(e.fecha at time zone 'UTC', 'YYYY-MM-DD') as dia,
           trim_scale(e.importe)::text as imp,
           o.ord,
           coalesce(substring(e.source from '^ob(?:-hist)?:([^#~]*)'), '') as banco,
           nullif(substring(e.source from '#acc([^#]*)'), '') as cuenta
    from public.expenses e
    cross join lateral (
      select coalesce(nullif(substring(e.source from '#n([0-9]{1,6})(?:#|$)'), '')::int, 1) as ord
    ) o
    where e.user_id = p_user
      and (e.source like 'ob:%' or e.source like 'ob-hist:%')
  )
  select coalesce(array_agg(distinct r.dia || '|' || r.imp || '|' || r.ob_name
                            || case when r.ord > 1 then '|#' || r.ord else '' end), '{}'::text[])
  from filas r
  where r.ob_name is not null
    and r.ob_name is distinct from r.comercio
    and r.banco <> '' and r.cuenta is not null
    and exists (
      select 1 from filas o
      where o.dia = r.dia and o.imp = r.imp and o.ord = r.ord
        and o.comercio = r.ob_name
        and o.banco <> '' and o.cuenta is not null
        and (o.banco, o.cuenta) is distinct from (r.banco, r.cuenta)
    );
$fn$;

-- Solo lectura: qué se levantaría, sin tocar nada.
create or replace function public.lapidas_renombre_viejas_dryrun()
returns table (user_id uuid, clave text)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select s.user_id, k
  from public.app_state s
  cross join lateral unnest(public.lapidas_renombre_claves(s.user_id)) k
  where jsonb_typeof(s.data -> 'deleted') = 'array'
    and s.data -> 'deleted' ? k;
$fn$;

create or replace function public.lapidas_renombre_viejas(p_user uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  r record;
  ahora bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  claves text[];
  levantar text[];
  nuevo jsonb;
  total integer := 0;
begin
  for r in
    select s.user_id, s.data
    from public.app_state s
    where (p_user is null or s.user_id = p_user)
      and jsonb_typeof(s.data -> 'deleted') = 'array'
    for update
  loop
    claves := public.lapidas_renombre_claves(r.user_id);
    select coalesce(array_agg(k), '{}'::text[]) into levantar
    from unnest(claves) k
    where r.data -> 'deleted' ? k;
    if coalesce(array_length(levantar, 1), 0) = 0 then
      continue;
    end if;
    nuevo := jsonb_set(
      r.data,
      '{deleted}',
      (select coalesce(jsonb_agg(v), '[]'::jsonb)
         from jsonb_array_elements(r.data -> 'deleted') v
        where not ((v #>> '{}') = any (levantar)))
    );
    nuevo := jsonb_set(
      nuevo,
      '{deletedAt}',
      case when jsonb_typeof(r.data -> 'deletedAt') = 'object' then r.data -> 'deletedAt' else '{}'::jsonb end
      || (select jsonb_object_agg(k, greatest(ahora, coalesce((r.data -> 'deletedAt' ->> k)::bigint, 0) + 1))
            from unnest(levantar) k),
      true
    );
    update public.app_state set data = nuevo where user_id = r.user_id;
    insert into public.lapidas_renombre_log (user_id, clave, levantada_ms)
      select r.user_id, k, ahora from unnest(levantar) k;
    total := total + array_length(levantar, 1);
  end loop;
  return total;
end
$fn$;

revoke all on function public.lapidas_renombre_claves(uuid) from public, anon, authenticated;
revoke all on function public.lapidas_renombre_viejas_dryrun() from public, anon, authenticated;
revoke all on function public.lapidas_renombre_viejas(uuid) from public, anon, authenticated;
grant execute on function public.lapidas_renombre_claves(uuid) to service_role;
grant execute on function public.lapidas_renombre_viejas_dryrun() to service_role;
grant execute on function public.lapidas_renombre_viejas(uuid) to service_role;

-- NO se ejecuta aquí: medir primero con el dry-run y lanzar `select public.lapidas_renombre_viejas();` a mano.
