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
--      del bancario (`ob_name <> comercio`). Es lo único que la función necesita mirar.
--   2. Tabla `lapidas_renombre_log`: qué lápida se levantó, a quién y cuándo. Sin políticas RLS:
--      solo service_role. Permite devolverla si algún día hiciera falta.
--   3. Función `lapidas_renombre_viejas(p_user)`: por cada usuario, una lápida global de `deleted`
--      cuya clave coincide con la de una fila VIVA renombrada (clave con `ob_name`) se LEVANTA: sale de
--      `deleted` y entra en `deletedAt` con una hora posterior (la regla de `unionPorHora` del cliente:
--      una hora gana a una copia sin hora de otro móvil guardada antes). Sin fila viva que la explique
--      no se toca nada: un borrado real de verdad no se resucita.
--   4. La ejecuta una vez (`select`) al final.
--
-- Espejo exacto de `lapidasRenombreViejas` (src/modules/00-core.js): clave = día UTC | importe sin
-- ceros de cola | ob_name [| #ordinal si el source lleva `#nK`, K>1]. Solo filas `ob:` y `ob-hist:`
-- (las únicas que renombraba la versión vieja; los manuales llevan el id en la clave).
-- El cliente hace lo mismo una vez por móvil con el histórico sincronizado, así que una copia de un
-- móvil que no actualice no devuelve la lápida: ver `lapidasRenombreMigra`.
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

-- Claves de lápida que explican las filas vivas renombradas de un usuario.
create or replace function public.lapidas_renombre_claves(p_user uuid)
returns text[]
language sql
stable
set search_path = public, pg_temp
as $fn$
  select coalesce(array_agg(distinct k), '{}'::text[])
  from (
    select to_char(e.fecha at time zone 'UTC', 'YYYY-MM-DD')
           || '|' || trim_scale(e.importe)::text
           || '|' || e.ob_name
           || case when o.ord > 1 then '|#' || o.ord else '' end as k
    from public.expenses e
    cross join lateral (
      select coalesce(nullif(substring(e.source from '#n([0-9]{1,6})(?:#|$)'), '')::int, 1) as ord
    ) o
    where e.user_id = p_user
      and e.ob_name is not null
      and e.ob_name is distinct from e.comercio
      and (e.source like 'ob:%' or e.source like 'ob-hist:%')
  ) t;
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

select public.lapidas_renombre_viejas();
