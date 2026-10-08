Edición de reglas de Metas108 integrada en fuente109: no borrar/recrear para editar. Preservar ID, `mensual`/legado y campos desconocidos, comparar estado fresco y conservar los asientos anteriores. El coordinador local26 serializa integración y concede Chromium; reportes propios mediante `MC_E2E_OUTPUT_DIR` para no borrar otras evidencias. [Acta](docs/briefs/inc-0810-metas-editar-regla.md).

Historial Perfil → Ajustes110: checkpoint aisladoedf1f3e3 sobre8dcc preservado; port exclusivo sobre109dded + reparación test-onlyf4ff. VERSION/package110, notas es/en/ca y unidad propia; conserva las36 unidades109 y las cinco retiradas. Port104:30 guardianes exit0 con1782func/701datos,21 contratos/47mutantes UI y18 DOM sin retries/skips/flaky. Causal8rojos sobre8dcc preservado; sin reclamar un causal DOM109 no ejecutado. Presupuesto oficial gzip9:1.325.236/361.308 B, delta3.413/1.134; topes1295/353/3, margen844/164 B. Sólo Brókers cambia entre36 identidades antiguas. Integración/publicación110, CI y móvil pendientes. [Acta](docs/briefs/inc-0810-backclose-handover.md).

Auth102 candidata local sobre101/77b7d5e4: cleanup de suscripción y callbacks tras desmontar; no cambia orden inicial ni acredita causa del lag. Nueva identidad propia, sin repin. [Acta](docs/briefs/inc-0710-auth-disposal.md).

Candidata101: `bankNotif` tiene la misma carrera de handle tardío que el listener de reentrada100. Cleanup de Promise y callback inerte; no alterar opción expresa, cupo ni sync. Cambiar uid antes de resolver el alta es necesario para reproducir la fuga: scroll por sí solo no lo acredita. INC-2709-09 sigue abierto. [Acta](docs/briefs/inc-0710-banknotif-cleanup.md).

Promoción96 consta fusionada en main85b8b540: preservar su [acta](docs/briefs/promocion-inicio96-2026-10-06.md) y comprobar publicador/artefactos exactos antes de limpiar el catálogo. El merge no acredita entrega ni aprueba99.

Gastos99 candidata local: ambos extremos y etiquetas de mes/mes pasado/3m usan Madrid; ciclo y rango siguen locales. No heredar aprobaciones de scopes afectados. [Acta](docs/briefs/inc-0710-gastos-mes-madrid.md).

Candidata98 local6/10 para el feedback de beta97.1: el FAB conserva contorno pero se queda atrás y desaparece tarde. Movimiento geométrico conjunto y guardián rAF natural preparados desde beta505; NO-GO visual hasta ejecutar rojo97/verde98. No reutilizar el verde97 como cierre; INC-2709-09 continúa abierto. [Acta](docs/briefs/inc-0610-fab-sync-hide-2026-10-06.md).

Snapshot de preparación4/10, superado por la aprobación de beta94.1 y la integraciónmain descritas arriba: borrador4.26.94 local, entonces sin terminar ni publicar. en Metas, una regla nueva descuenta del presupuesto del mes y aporta a la meta al guardarla (contrato decidido por el dueño tras su rechazo de la 4.26.87), además del importe leído como se escribe y el aviso si el alta no vale. Las reglas anteriores siguen repartiendo por ingreso. El rechazo sigue abierto hasta que él lo pruebe; la pasada de pantalla, la suite completa y la revisión del commit final están pendientes: no inferir aprobación. Actas: [contrato mensual](docs/briefs/inc-0410-metas-mensual.md) · [alta de reglas](docs/briefs/inc-0410-metas-alta.md).

Promoción4/10: las once tandas de beta4.26.94.1 tienen aprobación vigente. Producción4.26.94/source8bb0398f servida y cotejada; APK52 estable y las tres funciones Edge entregadas. La limpieza conserva notas y decisiones; solo retira las once entregadas, sin producto nuevo. Prioridad permanente: producción de lo aprobado antes de otra implementación. [Acta](docs/briefs/promocion-aprobadas-2026-10-04.md).

Corte 4/10, 02:35 UTC: el canal beta sirve 4.26.90.2 desde la fuente `7f3da23b` ([PR117](https://github.com/JuanjoAvila/Aely/pull/117), que solo añade una guardia de tests; publicación [37168006229](https://github.com/JuanjoAvila/Aely/actions/runs/37168006229) cerrada y cotejada). Lo que se usa es lo de 4.26.90.1 (merge `4a2e3c54`, [PR116](https://github.com/JuanjoAvila/Aely/pull/116)): Gastos oculta presupuesto fuera de mes/ciclo y usa todo el ancho, sin cambiar dinero, sobre Brókers89 ya entregada como 4.26.89.1 (merge `0f825c45`, [PR115](https://github.com/JuanjoAvila/Aely/pull/115)). Producción sigue en 4.26.86 (`d366215a`), sin promoción. Este corte describe lo acreditado al escribirlo: si `beta` ha avanzado, coteja el manifiesto antes de dar nada por servido. Nadie ha aceptado 89 ni 90 en el móvil; APK beta 4.26.80/code52 sin binario nuevo; Edge/SQL sin entregas. Entrega en beta, CI verde y aprobación son tres cosas distintas. [Gastos](docs/briefs/inc-0310-gastos-sin-limite.md) · [Brókers](docs/briefs/inc-0310-broker-resultados.md).

Histórico 3/10 (superado por el corte de arriba): Candidata90 local, con CI/publicación89 y DOM/revisión/CI90 pendientes; beta88.1 y producción86 eran las últimas acreditadas.

# Empieza aquí

Candidata107 de navegación: la rayita activa se oculta con la barra, con una revisión nueva
`inc-0810-nav-indicator`. No reutilizar las decisiones de contorno97/98: el ahorro de CSS cambia
su código, y el nuevo alcance conserva los controladores y geometría reales. La comparación
de tamaño se hace con finales LF normalizados ANTES del minificador; el blob de Git y un build
Windows CRLF difieren en24bytes exteriores. [Acta y límites](docs/briefs/inc-0810-nav-indicator.md).
39 comprobaciones de navegador sintético pasan; la base falla12 por rayita visible. CI exacta
en el PR; publicación y móvil pendientes. El coordinador integra tras entregar las cinco
aprobadas. No confundir107 fuente con versión servida. La transferencia Perfil→Ajustes→‹
rompe el historial también en8dcc y conserva una incidencia OPEN separada.

FEATURE-0210-01 candidata aislada85: no mover keywords nuevas a autoCategory, porque seedFlows reevalúa Otros antiguos. La división Gasolina/Taxi vive solo en categoryOfNewMerchant y MCC de altas bancarias. Fuente Edge preparada pero sin desplegar; la web no necesita Edge para elegir/filtrar/fijar límites. [Acta](docs/briefs/feature-0210-01-gasolina-taxi.md).

INC-0210-01 candidata83: cuota vinculada contabilizada antes del vencimiento retirada del pendiente de Plan/Inicio y eventos futuros; saldo/anclas intactos. Base3467/candidata82, sin publicar. Pruebas sintéticas; revisión, CI, beta y móvil pendientes. [Acta](docs/briefs/inc-0210-01-plan-cuota.md).

Candidata Validaciones82 tras NO-GO450: conservar aprobación/progreso y la checklist actual junto a las rondas modernas si producción no responde. Sobre beta80/source955765a9;81 no publicada. APK80/52 intacta; DOM mixto70/70, contratos Node y A/B acreditados; revisión independiente y CI exacta pendientes. No integrar/publicar una solución parcial. [Acta](docs/briefs/ops-0110-validaciones-persistentes.md).

Snapshot previo de preparación80 (no estado de la candidata81): Widget80 sobre79/d45fb8b1; runtime821/ACK/guiones intactos. Prebuild52/name80 y descarga de assetbeta602841368 verificados; manifiesto52 local real. CI/build final/reemplazo APK/entrega80 pendientes; no main/Edge/SQL/install. [Acta](docs/briefs/inc-2909-01-widget.md).

Nómina78 candidata en rama aislada sobre UI77 finalca7734fd. Runtime5c2146c3 conservado, cuatro fixtures DOM4/4 y guardianes afectados verdes; CI exacta y publicación retenidas por el coordinador. PR96/número76 antiguos retenidos. Lease27 liberado tras su prueba focal. [Acta y rebase](docs/briefs/inc-3009-nomina-anticipada.md).

Integración UI en una sola candidata 4.26.77 con tres tandas (Cyberpunk, Preguntar, Perfil): los números 79/80/81 que aparecen en sus actas de origen eran reservas provisionales y no son entregas. Las tres fuentes conservan su runtime exacto, van montadas sobre la fuente del panel76 y esperan CI exacta y gate. Node, scopes, tamaño y DOM propios se registran en [acta](docs/briefs/ui-77-integracion.md). No lanzar Chromium sin lease canónico.

Lee esto **antes de tocar nada**, seas Claude Code (PC o móvil), Cursor, o cualquier otro.
Son cinco minutos que ahorran medio presupuesto de tokens. Está escrito porque el 26/7/2026 una
sesión del móvil se gastó la mitad trabajando sobre una rama equivocada.

> **Para continuar el trabajo:** [docs/BACKLOG.md](docs/BACKLOG.md) es el índice operativo,
> con prioridades, encargos para Claude/Cursor, criterios de cierre y lo ya terminado.
> El panel de beta no contiene todo el backlog. El relevo de madrugada del 9/9 quedó superado
> por la auditoría posterior: efectivo e histórico conservan fallos abiertos.

## 1. Lo primero, siempre

Panel76 se prepara sobre beta75/ca7b97d4 por la reclamación de siete tandas: ninguna tiene entrega completa acreditada. El recibo ausente no prueba por sí solo un bug ni autoriza ocultarlas. [Auditoría y límites](docs/briefs/ops-0110-panel-entrega.md); no confundir aprobaciones sintéticas de tests con últimos veredictos remotos.

INC-2909-02: beta4.26.73.1 publicada y cotejada30/9a20:55UTC, PR82/mergea03a2a06/CI36774395712SUCCESS. Candidata separable PR80/3912aa11GOClaude yCI36773669265SUCCESS; integración71b6e552GOClaude,529E2Epass/1skip local y522funcionales+7rendimiento enCI. [Acta](docs/briefs/inc-2909-02-inicio-natural.md). FaltaOKmóvil; producción4.26.67/APK48intacta. Recibos fue rechazado: reparar en chat propio; Claude implementa panelPR83. Hay un coordinador nocturno activo autorizado por eldueño, no duplicarlo.

Corte 30/9: producción web 4.26.67 [publicada y cotejada](docs/briefs/inc-2709-02-prod.md) tras el OK exclusivo de `inc-2709-02-deudas-archivo`; beta 4.26.71.1 conserva las siete pruebas anteriores y añade la del gas. APK estable 48 y beta 51, sin promoción nativa. El usuario notificó además tres fallos independientes: widget sin «Mi ciclo», gas del 25/9 todavía en «Próximos cargos» el día 30 y nómina de Sabadell visible antes de cobrarla. Revalidar ramas, manifiestos, ZIP, SW, Actions y el estado de cada fallo; no dar por correcto un ingreso ni un cargo por la fecha prevista. El [backlog](docs/BACKLOG.md) conserva las prioridades y el límite de cada tanda.

INC-3009-01: beta 4.26.71.1 publicada y cotejada, CI 36764259812 SUCCESS sobre 79b981ad; pendiente de prueba y aprobación móvil. PR76 permanece en borrador. Siguiente objetivo recomendado: INC-2909-02, 0 % al salir de Mi ciclo, tras volver a comprobar aprobaciones. [Acta](docs/briefs/inc-3009-01-cargos.md).

El corte operativo está en [BACKLOG](docs/BACKLOG.md), [ROADMAP](docs/ROADMAP.md) y el acta más reciente de `docs/briefs/`. Al entrar, actualiza `origin/beta` y `origin/main`, ejecuta `npm run listo` sobre fuente beta efectiva y coteja PR, Actions, manifiestos, ZIP, HTML, SW y APK servidos. Una CI verde o una release publicada no acreditan el veredicto móvil. Si falta `SUPABASE_SERVICE_ROLE_KEY`, `listo` no puede leer aprobaciones y ninguna tanda nueva se presume aprobada.

Corte 29/9, 20:19 UTC: beta `4.26.70.1`/merge `9b0cc935`/huella `4495e50005bdc9eb` y producción web `4.26.66`/`c2b02ed8`; APK estable 4.26.32/code 48 y beta 4.26.55/code 51. Después, el dueño comunicó en chat que aprobó INC-2709-02; su promoción selectiva queda pendiente al cerrar la jornada. INC-2709-01, INC-2809-02 y las cinco tandas nativas conservan sus veredictos propios. [Acta de deudas](docs/briefs/inc-2709-02-deudas-archivo.md) con CI, ZIP, HTML, SW y límite financiero. Hay además un [encargo de auditar «Pruebas» beta](docs/BACKLOG.md#pruebas-beta--auditar-acumulación-antes-de-limpiar--29-de-septiembre-de-2026). El estado público puede haber cambiado desde este corte.

```bash
git fetch --all --prune && git log --oneline -5 refs/heads/beta && cat VERSION
```

**El trabajo vivo está en `beta`, no en `main`.** `main` es lo que usan su padre y su pareja, y
suele ir una versión por detrás. Si cortas una rama de `main` estás trabajando sobre código viejo:
tus arreglos ya pueden estar hechos, y tu bump de versión le BAJARÍA la versión a la gente.

**Deudas (INC-2709-02):** `debtBalance` llega a cero por calendario, aunque nadie haya confirmado la última cuota. No se debe convertir ese 0 proyectado en pago bancario ni borrar la deuda al archivarla: su `id` sigue dando nombre a las cuotas antiguas de Gastos. La confirmación y el archivo viven en Plan → Deudas; el estado y las pruebas están en `docs/briefs/inc-2709-02-deudas-archivo.md`.

## 2. Las siete trampas que más caro salen

1. **`beta` es rama Y tag a la vez.** El tag lo usa el workflow del canal de pruebas para publicar
   los assets, así que **no se borra** aunque apunte a un commit viejo. Efecto diario:
   `git push origin beta` falla con «src refspec beta matches more than one» → usa
   `git push origin refs/heads/beta:refs/heads/beta`. Igual con `git log beta` → `refs/heads/beta`.
   Para cambiar de rama, `git switch beta`; `git checkout refs/heads/beta` desengancha HEAD.
   **Incidente 2026-09-08:** se fusionó en HEAD separado y `beta` no se movió — el trabajo parecía
   subido y no lo estaba. Rescatado de la PR #41 al cerrarla (9/9).
   **Cursor trabaja en worktrees propios:** no cambia de rama en el checkout compartido.
2. **La versión canónica es el fichero `VERSION`**, no `package.json`. Bumpear solo `package.json`
   es un fallo silencioso: el deploy sale verde y el móvil no se entera de nada.
3. **La fuente es `src/modules/*.js` + `src/shell.html`.** `public/index.html` es el ARTEFACTO que
   genera `npm run build`. Editar `public/index.html` a mano se pierde en el siguiente build.
4. **`npm test` falla en `docs-frescura` en cualquier rama que no se llame literalmente `beta`.**
   Es la excepción por diseño («no hay código publicable sin subir VERSION»), no es tu commit.
5. **En un portátil no se ven los problemas de rendimiento del móvil.** Cero tareas largas hasta
   estrangular la CPU x6 por CDP. Método completo y trampas en `AGENTS.md` §7 y §7 bis.
6. **En `beta` los tests se recortan.** Un `e2e/*.spec.mjs` nuevo va a `E2E_MAP` o `CROSSCUTTING`
   en `scripts/relevant-tests.mjs`; un unitario, a `steps` en `run-tests.mjs`. Si te olvidas, el
   CI aborta (no se duerme). Promote y `main` siguen corriendo la suite entera.
   ⚠ El guardián caza el spec **huérfano**, no el **mal colgado**: si `gastos-cajones` se pone
   bajo otro módulo, `beta` sale verde sin abrir Gastos. Un verde en `beta` no pesa lo mismo
   que un verde en `main`.
7. **No afirmar como hecho lo que solo está en el disco.** «En beta», «subido», «EN 4.18.0 beta»
   en una tabla de estado = el commit está en `origin/beta` (y el móvil lo puede bajar cuando
   Actions publique). Codeado en esta sesión, sin push, se dice **sin commit / sin push**. Pasó
   el 17/8 con las tandas 3 y 4: la tabla mentía y él lo cazó. **Un brief también es una
   afirmación:** el mismo día se subió `brief-claude-destello.md` del 5/8 como si el WIP .13
   existiera; no existía, y el .12 ya estaba aprobado. Si el forense vale, se deja; el estado
   caducado se marca arriba. Piénsalo dos veces antes de afirmárselo.

> **Atajo para las de golpe: `npm run salud`** (desde 4.13.0). Contesta en veinte segundos
> lo que si no se comprueba a mano: si los cuatro sitios donde vive la versión cuadran, si la APK
> anunciada existe de verdad, **qué sirve producción ahora mismo** (preguntándole a Pages, no
> leyendo el repo), si la beta va por delante o por detrás, y qué commits hay en `beta` sin
> promocionar. Empieza por ahí antes de tocar nada.

> **Y si los e2e no arrancan por el navegador** («Executable doesn't exist at …»), no lances
> `npx playwright install`: en los entornos con Chromium ya instalado se apunta al que hay con
> `PLAYWRIGHT_CHROMIUM_PATH=/ruta/al/chrome` (la config lo lee). Instalar otro se come el disco y
> tarda diez minutos para nada.

## 3. Cómo se publica

Circuito corto y trampas: **[`docs/RELEASE.md`](docs/RELEASE.md)**. Resumen:

| Quieres… | Haces |
|---|---|
| Que lo pruebe él en su móvil | push a `beta` → el workflow publica el bundle en la release `beta` |
| Subirlo a producción | workflow «Promocionar beta a producción» (`gh workflow run promote-beta.yml -f confirmar=SUBIR`) |
| Cambiar algo NATIVO (iconos, Java, permisos) o APK alineada | **`npm run release:apk`** (WEBDEBUG off, firma, release GitHub, `apk.json` real) |

**No se promociona nada sin que él lo apruebe** desde Ajustes → «Revisar esta beta».
El veredicto se lee con `node scripts/errores.mjs --kind=beta`, y las sugerencias que escribe la
familia desde la app con `npm run sugerencias`. **Míralas al empezar**: dos de su pareja pasaron
diez días sin que las leyera nadie, y una era un bug de verdad.

**Play Store es lo último de lo último** (17/8). Sideload sí; publicar en Google no, hasta que él
diga que está hiper pulida. Si aparece una tanda nueva, va **antes** de Play Store, nunca después.
Si se implementa Play Store pronto, se tienta de colgarla y no quiere.

## 4. Cómo se escribe para él

- **Las notas de versión (`RELEASE_NOTES`) las lee toda la familia.** Genéricas y en cristiano:
  ni dirigidas a él, ni de la cocina (betas, canales), ni técnicas (px, identificadores). El porqué
  técnico va al `CHANGELOG`, que ahí sí se quiere con detalle. Regla y ejemplos en `AGENTS.md` §4.
- **Toda versión publicada lleva su entrada**, también las `.1`. Y en **es/en/ca**.
- **Nunca «no se puede».** Se investiga hasta encontrar una vía y se presentan opciones.
- **Nunca editar ficheros con PowerShell** (`Get-Content|Set-Content` corrompe el UTF-8 y mete BOM:
  costó un APK inservible ya publicado a su familia). Usa las herramientas de edición.

## 5. Todo lo que se sabe está aquí, no en la cabeza de nadie

`docs/memoria/` es el espejo de la memoria del agente: el histórico de por qué se decidió cada
cosa (la saga de Trade Republic en frío, los tres intentos del gesto del perfil, la estrategia de
escalado, el backlog largo) y cómo le gusta trabajar a él. **Se regenera con `npm run memoria` y
`npm test` avisa si se ha quedado atrás.** Está tachado de datos personales porque el repo es
público — si añades un tipo de dato nuevo, añade su filtro en `scripts/sync-memoria.mjs`.

Si aprendes algo que le habría ahorrado tiempo a la siguiente sesión, **escríbelo aquí mismo**.
La norma completa está en `AGENTS.md` §6 ter.

## 6. Estado y pendientes

`docs/ROADMAP.md` es la foto de ahora: qué versión va por dónde, qué está hecho y qué falta.
La cola reconciliada y los encargos pendientes viven en **[docs/BACKLOG.md](docs/BACKLOG.md)**.
`CHANGELOG.md` es el porqué de cada cosa. `AGENTS.md` son las reglas de la casa.
Los tres se mantienen al día en cada tanda — si no cuadran con `VERSION`, `npm test` te lo dice.

**Qué versión hay hoy:** no lo pone aquí a propósito. Este párrafo decía «4.18.2 en `beta`» desde
agosto y siguió diciéndolo diez versiones después, así que mentía justo al que abre el repo por
primera vez. El número vive en `VERSION` y lo publicado se pregunta con `npm run salud`; los dos
comandos están arriba, en el punto 1. El widget con la app cerrada va por `ingest` (un solo
Supabase), no por el canal. Circuito: [`docs/RELEASE.md`](docs/RELEASE.md).
Antes de tocar nada, **`npm run salud`**.

### Si él escribe desde el viaje («¿ya está Pages?»)

→ **[`docs/briefs/brief-crucero-verificar-pages.md`](docs/briefs/brief-crucero-verificar-pages.md)**  
Solo verificar / relanzar deploy. **No features.** Al salir, Pages aún podía servir **4.15.0** por
outage de GitHub (no por cuota de minutos). Supabase/Wallet ya OK. Frase para pegarle al Claude del
móvil: *«Mira docs/briefs/brief-crucero-verificar-pages.md y comprueba Pages 4.16.1»*.

### Hecho esta noche (no reabrir)

- 4.16.0/4.16.1 en `main`: notis Google Wallet, migración 0020, presupuesto servidor=app, APK 39.
- Guardián WEBDEBUG + `npm run release:apk` (para que el próximo deploy no sea otro calvario).

### Al volver del crucero (2026-08-17)

Plan de tandas + reparto Cursor/Claude:
[`docs/briefs/plan-vuelta-crucero.md`](docs/briefs/plan-vuelta-crucero.md).
**Tanda 17 = diseño** (mock Claude Design, `docs/design/handoff/`). No mezclar con dinero ni destello.
Play Store sigue **la última**. Widget 4.17.2 **no** está en `main`.
Inventario largo: [`docs/memoria/mi-cartera-backlog-2026-08.md`](docs/memoria/mi-cartera-backlog-2026-08.md).
Import histórico (ya diseñado): [`docs/briefs/plan-import-historico-seguro.md`](docs/briefs/plan-import-historico-seguro.md).

⚠ `docs/memoria/pendiente-manana-4-12-0.md` es espejo viejo (**no editar a mano**).
**La foto de ahora es `docs/ROADMAP.md`.**

Detalle y checklist en `docs/ROADMAP.md` y `docs/TESTING.md`. **No promocionar sin su OK** en el panel.

La cola post-rechazo se contrasta con `npm run listo` y [docs/BACKLOG.md](docs/BACKLOG.md).
`docs/memoria/mi-cartera-backlog.md` conserva historia: no asumir que sus rechazos o pendientes
son actuales. El header del ROADMAP puede ir por detrás del último veredicto.

## Integración aislada del panel75 (1/10/2026)

Base real Recibos74 9ecd6a172e1c451016e6b4e102fa7b8e8bdc5359. No reutilizar GO483e8874 como aprobación del nuevo SHA integrado. Mantener siete referencias históricas: tres códigos idénticos conservan OK, cuatro cambios web de Inicio73 necesitan revisión nueva. No repinar ni recortar dependencias financieras para conservar aprobaciones.75 sigue local; el coordinador autoriza publicación tras verificar74 servida y concede Chromium por lease canónico. Bootstrap main PR92/2f045a1e conserva gate propio; ninguna entrega exacta puede inventarse. [Brief](docs/briefs/ops-3009-03-panel-beta.md).


Integración88 actual: fuente mínima PR108/2205 sobrebeta039d, preservando21alcances/notas208anteriores. Fuente enverificación, sinpublicación. Producciónwebaprobada86 se prepara independientemente, no promover88 por asociación.

## INC-0310 resultados de brókers · candidata89

WT aislado desde beta ba206, fuente y pruebas de resultados separados; [acta](docs/briefs/inc-0310-broker-resultados.md). No confundir fuente/DOM sintético con sync bancaria real ni con el pago ausente. La producción113 se fusionó con autorización humana directa solo para20webaprobadas; no promover beta completa.

Autorización vigente del3/10: se permiten subidas a producción de superficies con aprobación humana acreditada para su código exacto y alcance separable. CI o revisión técnica no sustituyen el veredicto humano. No promover beta entera si contiene otras superficies; APK/Edge/SQL/migraciones y dinero real conservan sus gates propios. PR113 está fusionada en d366 con veinte web aprobadas; su entrega requiere los artefactos servidos, no solo el merge.

Candidata106: memo de recientes en Inicio con deps expenses/deleted. A/B con callback React real, no virtual. DOM/CI/revisión/presupuesto sellado/publicación pendientes; INC-2709-09 abierto. No heredar aprobaciones de otras tandas de Inicio. [Acta](docs/briefs/inc-0810-dashboard-recents-memo.md).
