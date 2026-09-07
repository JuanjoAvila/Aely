<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (mi-cartera-backlog-2026-08.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: mi-cartera-backlog-2026-08
description: "INVENTARIO ÚNICO Y COMPLETO (2026-08-04) — todo lo pendiente en un solo sitio, ordenado fácil→difícil. Reúne las TRES fuentes que antes estaban sueltas: sus veredictos rechazados del panel de beta, el backlog histórico (review de ChatGPT + peticiones suyas) y lo nuevo. Con fecha dura: multidivisa/liras para el crucero del VIERNES 7/8."
metadata: 
  node_type: memory
  type: project
  originSessionId: d6ae387e-f9d4-460d-b8dc-c43511bd8b4c
  modified: 2026-08-18T19:35:55.816Z
---

**⚠ ESTE FICHERO ES LA LISTA ÚNICA. Si aparece algo nuevo, va aquí.** Se armó porque el 4/8 le di un
inventario que se dejaba fuera sus veredictos rechazados y el backlog histórico, y me corrigió:
«te he dicho TODO y que esté bien por escrito para que sesiones nuevas lo tengan bien estructuradito».

**Regla de trabajo (suya, 4/8): de UNO EN UNO.** Ver [[feedback-de-uno-en-uno]].
**Estado (5/8):** producción **4.13.0** · APK **35 / 4.12.0** (sin cambios nativos, llega por OTA).
Fuentes que alimentan esto: `node scripts/errores.mjs --kind=beta` (sus veredictos),
[[mi-cartera-backlog]] (histórico + review ChatGPT), `docs/ROADMAP.md`, y lo que pida en sesión.

---

# 🚢 0-BIS. LO QUE APUNTÓ EN EL CRUCERO (2026-08-17) — 12 cosas de golpe
Orden y detalle en el repo: [`docs/briefs/plan-vuelta-crucero.md`] (10 tandas, uno en uno).
Aquí solo el inventario, para que no se pierda ninguna.

**Bugs**
1. **Widget vs app: cifras distintas.** «Sale un valor en el widget y otro en la app; al cerrar se
   actualiza bien y al cabo de un rato vuelve a salir otro». → **ARREGLADO en 4.16.2 / APK 40**
   (tanda `widget-coherente`, en beta el 17/8, pendiente de su veredicto). ⚠ Queda abierto el
   **Δ 205 €** entre la cifra de la noti y la de la app: ver [[mi-cartera-roadmap]].
2. **Revolut del padre a −204,54 € de la nada.** Sincroniza y se arregla. «Quizás son dos cosas
   diferentes» (suyo, y tenía razón: es otra tanda). Candidato: `pickBankBalance` cae a
   `balances[0]` a ciegas. ⚠ **No diagnosticable hasta que su padre salga del nativo 4.12.0.**
3. **Al actualizar Open Banking, el dinero del banco no cuadra en Cartera** — con la integración
   DIRECTA de Trade Republic sí cuadra. (Se refería a TR todo el rato.)

**Gastos**
4. **Detectar el banco** del que sale un ingreso o un pago, y que se vea.
5. **Clasificar lo que NO cuenta**: «hay bastante caos entre gastos que cuentan, ingresos y
   movimientos que no cuentan, sean inversiones o movimientos sin más».
6. **Renombrar «Movimiento»** en lo que entra de TR por Open Banking: «queda feo». (Enable Banking
   no manda nombre de comercio de TR — es un override manual que hay que recordar.)
7. **Más tipos de gasto**: heladería, joyería, crucero, Steam, Instant Gaming «y muchos más».
8. **Mejorar la «IA» que elige el tipo de gasto.**

**Interfaz**
9. **El filtro guapo de Gastos, también en el `+` y al editar** un gasto.
10. **El filtro de rango de fechas saca una ventana de Android** — quiere calendario propio.

**Nuevo**
11. **Meta ahorrada que sustituye TEMPORALMENTE el «gasto del mes»**: gastar de la hucha de una meta
    no es gasto corriente. Si marcas varios bancos en la meta, un gasto de esos bancos elige la meta
    solo. Al llegar a 0 €, vuelve el presupuesto normal. ⚠ Toca `monthBudgetStats` en TRES sitios
    (cliente, ingest, widget) → **no empezar hasta que la 1 esté aprobada**.
12. **Controlar el dinero en EFECTIVO**: lo que tienes, lo que entra y lo que sale.

⚠ Mandó **3 capturas** de los bugs 1–2 (widget, y la foto azul del Revolut del padre) a Cursor;
Claude Code trabajó con las cifras transcritas. Si hace falta afinar, pedírselas otra vez.

---

# ⏰ 0. CON FECHA DURA — el crucero sale el VIERNES 7/8/2026 ✅ PASADO
**Multidivisa real (liras turcas).** Paga con Revolut, que permite cambiar EUR→TRY. Quiere que detecte
la moneda, haga el cambio solo y que **los gastos en lira salgan bien**, «pulidísimo». Hoy
`settings.moneda` («moneda de visualización») **existe pero NO hace nada** y la lira ni está en la
lista. Enlaza con el «todas las monedas» del backlog histórico (§6.5), que hasta ahora era «para un
futuro» y **ahora tiene fecha**. Es lo único que se pierde si no llega a tiempo.

---

# ✅ 1. RONDA 4.13.0 CERRADA — TODO EN PRODUCCIÓN (5/8 de madrugada)
Las tres rechazadas del 4/8 están arregladas, aprobadas por él en el móvil (`4.13.0.49`) y
promocionadas. **Producción = 4.13.0.** El array `tandas` quedó vacío, como debe ser.

- **`tutorial-gestos` 🎓** — el tour medía el elemento UNA vez tras una espera fija de 520 ms; si esa
  foto caía con el carrusel aún deslizándose, el recorte se quedaba clavado a medio camino **para
  siempre**. Ahora se pega al elemento fotograma a fotograma hasta que está quieto (`9c7c569`).
- **`plan-swipe` 👇** — los dos gestos decidían el eje **por proporción a los 10 px**, y el arco del
  pulgar sale de lado primero → «horizontal» para siempre. Ahora `gestureAxis` en `00-core.js`, una
  sola función para ambos, por ventaja en píxeles (`2cbc091`).
- **`gestos` 🎯** — lo cerró **Cursor** de madrugada, 35 commits (ola nativa arriba/abajo, barra
  quieta, rayita). Yo lo había dejado sin tocar a propósito.

⚠ **Por qué yo no pude con `gestos`, que es la lección reutilizable:** el «muro invisible» y la «ola»
son **inercia y compositor**, y los toques sintéticos de CDP **no generan scroll por momentum**
(medido: un tirón deja Deudas en 425 de 3695, solo lo que arrastra el dedo). Con la sonda sobre su
móvil real quedó además desmentida mi hipótesis: **la deriva lateral NO bloquea el scroll en su
aparato** (gesto real con 90 px de deriva scrolleó perfecto) — era un artefacto del entorno de
pruebas. Menos mal que no subí el `touch-action:pan-y`. Queda el comentario en `src/shell.html`
explicando por qué NO está puesto.

**Aprobadas y ya subidas (4/8):** `bancos` 🏦 (16 ok / 0 fallo — **por fin aprobada**, cierra
[[tr-duplicados-saga]] y el signo en positivo; 3 ítems marcados "no probable" sin tocar: detección de
duplicados en import histórico y reconectar TR), `import-docx-pdf` 📄 (nueva, importar desde Word/PDF
además de Excel), `reservar`, `temporada`.
Aprobadas en rondas previas: `import`, `arranque`, `canal`.
⚠ Al aprobar+subir una tanda **se BORRA del array `tandas`**, no se marca hecha
([[feedback-tandas-desaparecen-al-subir]]).

---

# 🧹 1-BIS. LIMPIEZA MASIVA DEL REPO — tarea propia, pedida el 2026-08-17
**Todo backend, no toca nada que él vea.** Nace de encontrar `tools/movil/_uidump*.xml` y
`_flicker_frames/` sueltos, worktrees de agentes ya entregados, y **dos tests que existían pero que
el runner no ejecutaba** (`widget-coherente`, `ob-renombrar`: guardianes de bugs de dinero
publicados en beta sin que nadie los corriera).

Alcance: restos de depuración, ramas muertas, worktrees, código muerto, comentarios que ya no
dicen nada, flags que quedaron fijos. ⚠ **Ramas y worktrees se preguntan antes de borrar** — puede
haber trabajo sin subir de otra sesión.

**La norma preventiva YA ESTÁ ESCRITA** en `AGENTS.md` §3 bis («No dejes restos: se recoge en la
MISMA tanda»), que es lo que Cursor lee solo. Y el runner ya **aborta** si encuentra un test que
nadie ejecuta. Esta tarea es para lo YA acumulado; la norma es para que no haga falta repetirla.

---

# 🐛 2-BIS. NUEVO (2026-08-18) — un gasto de Revolut baja el saldo de Trade Republic
**Medido en su nube, no deducido: 257,17 € de desfase HOY.** `dynBal()` resta al saldo de la
cuenta diaria (TR) el `thisMonthSpent` **entero**, que desde que `expenseBanks` tiene tres bancos
(`myinvestor`, `trade_republic`, `revolut`) ya no es «lo que salió de TR». Y las cuentas no-diarias
no lo compensan: su saldo solo lleva fijos/flujos, no gastos. El patrimonio TOTAL cuadra; el
reparto entre bancos no. Afecta a Cartera, a `safeLiq` (el «Puedes gastar» del widget) y a las
alertas de saldo mínimo. **No confundir con el Δ 205 del widget** (ese era `spent`, ya cerrado).
⚠ La fórmula del saldo de la cuenta de gasto y su INVERSA están escritas en **cinco** sitios
(`11-app-main:1453`, `01-i18n:2167` y `:2173`, `07-tab-patri-fijos:12` y `:20`, `06-sync-brokers:468`):
cambiar solo unas cuantas hace que editar el saldo a mano guarde un número torcido. Plan sellado en
`docs/briefs/bug-saldo-cruzado-gasto-diario.md`. OTA, sin APK. Va ANTES de las tandas 5 y 6.

# 🐛 2. BUGS VIVOS (de más fácil a más difícil)

1. **Ajustes → «Dinero» lleno de cosas muertas o duplicadas** (petición suya, 4/8):
   - `Presupuesto mensual` → **quitar** (ya se edita en Resumen).
   - `Moneda de visualización` → **no hace nada**, y falta la lira turca → se resuelve con §0.
   - `Comparar monedas` → «un montón de filas y todo vacío».
   - `Bancos de gasto diario` → **quitar**, ya está en Cartera (se puso ahí a propósito, decisión suya).
   - `Total de gastos` → **ESE SÍ se queda**.
2. **Doble filtro de bancos en «Mis bancos»** (de su veredicto del 3/8): «te da a elegir entre los
   bancos conectados… y da igual lo que elijas, luego hay otro filtro para elegir los bancos».
   ⚠ Probablemente resuelto: iba en la tanda `bancos`, que el 4/8 se aprobó 16 ok/0 fallo. **Sin
   confirmar del todo** — no hay ítem explícito sobre el doble filtro en el detalle de la tanda.
3. **El presupuesto del mes en Resumen no cuadra**: «no pilla correctamente el balance correcto de lo
   que queda realmente para gastar». Mirar si Resumen usa un cálculo distinto al `monthSummary` de
   Gastos (que ahora descuenta `reservedSince` y las categorías neutras `CAT_NEUTRAS`).
4. **El widget de Android descontrolado**: no actualiza lo que queda para gastar. Se tocó el 1/8
   (`MiCarteraWidget.build()` + `updatePeriodMillis` 0→6h) pero **nunca se validó**. Nativo → APK,
   ver [[mi-cartera-android-build]].
5. **Gastos de bancos que no son el de gasto diario no entran** (Revolut vacío, Sabadell solo
   ingresos, la salida del traspaso no se ve en Sabadell). **Es POR DISEÑO** (evita duplicar con los
   Fijos modelados) pero él lo vive como bug: «todos los malditos gastos que no sale ni uno». Existe
   `settings.expenseBanks` para ampliarlo — **decidir con él**, tiene coste de doble conteo.

---

# 🚀 3. EVOLUTIVOS PEDIDOS POR ÉL

6. **★★★ IMPORT HISTÓRICO SEGURO — lo que más le importa.** Quiere decirle a su pareja y a su padre
   «dale a importar 3 meses sin miedo». **HOY NO SE PUEDE.** Auditado el 4/8 (`BankHistoryImport`),
   cuatro agujeros + lo que él mismo reportó al probarlo:
   - `defDest` manda a **"recibo"** todo cargo que no sea de tarjeta → crea un **Fijo mensual
     PERMANENTE** que resta todos los meses para siempre.
   - `fixNames` compara **nombre exacto + importe + cuenta**: el banco pone «RECIBO ENDESA ENERGIA XXI
     SA» y él tiene «Luz» → **duplica**.
   - **No cruza contra `state.debts`** (tiene 5 deudas) ni contra metas/ahorro — lo pidió él expresamente.
   - **No hay deshacer.**
   - Su prueba real (3/8): «me dice que hay duplicados y lo tacha, y selecciona uno que no es
     duplicado que realmente SÍ lo es, y me lo duplica en recibos».
   Riesgo: padre BAJO (empieza de cero, 3 fijos — su caso de uso), pareja MEDIO (8 fijos), él ALTO
   (15 fijos + 5 deudas).
   ⚠ **Debe valer para CUALQUIER banco, no solo TR** (aviso suyo 4/8): con Google Wallet se meten
   tarjetas de cualquier banco y todas registran importes.
7. **Notificación push de nueva versión** — para que su pareja se entere sin que él se lo diga.
   Necesita FCM/OneSignal: proyecto aparte.
8. **Planes de pensiones (CaixaBank) y cuentas de ahorro** — toca Open Banking / scope nuevo.
9. **MyInvestor nativo** (WebView que cargue myinvestor.es y genere el reCAPTCHA en su dominio).
   Java + APK + su login real. Arrastrado desde la 4.10.0.
10. **Splash: dos renders sin unificar** (icono nativo suelto + tarjeta del splash JS). Aparcado en
    `wip/splash-icono-nativo`, ver [[splash-nativo-saga]].

---

# 💡 4. TANDA «FINANZAS DEL DÍA A DÍA» — le gustan TODAS (ninguna empezada)
Las apuntó él expresamente. **El informe mensual es el favorito de su pareja → sube de prioridad.**
11. **Modo «fin de mes en paz»** — «a este ritmo acabarás el mes con +X €» + aviso si va a pasarse.
    El motor de cash-flow ya existe: es juntar piezas.
12. **Presupuesto por categoría** — límite opcional en Súper/Bares/Ocio con su barrita.
13. **Informe mensual automático** — el día 1, resumen del mes cerrado. ★ favorito de su pareja.
14. **Recordatorio de recibos gordos** — «mañana pasa el seguro (230 €) y el saldo proyectado no llega».
15. **Exportar informe PDF/imagen del mes** para WhatsApp (encaja para sus padres).
(El **widget de Android** de esa lista original ya existe — su bug vive en §2.4.)

---

# 🏠 5. HOGAR / CUENTA FAMILIAR — alcance decidido, diseño pendiente de su OK
Sus padres comparten UNA cuenta de CaixaBank y quieren ver «todas las cuentas de ambos en sus
respectivas apps». **Alcance que él decidió (13/7): se comparte TODO** — patrimonio, cuentas una a
una, gastos del día a día y fijos.
Diseño propuesto y **pendiente de su OK**: **hogar espejo de solo-lectura mutua** — cada uno sigue
siendo dueño de su estado; el hogar añade una VISTA fusionada vía snapshots sanitizados (tablas
`household` + `household_members` + snapshots), **no** escritura cruzada en el `app_state` del otro.
Ventaja: des-compartir = borrar la fila. Necesita 2 cuentas reales para probar.
Fase 1 = crear hogar + invitar por código + Patrimonio fusionado. Fase 2 = gastos fusionados.

---

# 🔍 6. DE LA REVIEW EXTERNA DE CHATGPT (tabla en `docs/ROADMAP.md`)
⚠ **La mitad de lo que propone YA ESTÁ HECHO** — la tabla separa estado real vs tarea con la prueba
de cada «ya está», para no volver a proponerlo. Lo que falta de verdad:
16. **Validar la entrada de las 10 Edge Functions** — único ROJO de `docs/AMENAZAS.md`.
17. **Auditar qué acaba en los logs** y **extender el rate limit** (las otras dos de AMENAZAS).
18. **Beta con más de un móvil** — hoy el canal es solo el suyo. ⚠ Rechazado a propósito un **tercer
    canal Experimental** y **feature flags ahora**: lo que falta son más móviles, no más canales.
19. **Analítica de uso** — instrumentar YA, el histórico no se recupera hacia atrás. Barato:
    `kind` nuevo en `app_events` + vista SQL. ⚠ Vocabulario CERRADO (`USO_OK`), nunca etiqueta libre.
20. **Separar la lógica financiera de React** e **interfaz común de bancos (adapters)**.
21. **Importador PDF** y **backup automático con restauración PROBADA**.

---

# 🏪 7. BLOQUEANTES DE PLAY STORE (no de la beta)
22. **NOMBRE NUEVO — decidido que se cambia, sin elegir.** Ya existe una app «Mi Cartera» en Play y
    el Gobierno tiene «Cartera Digital Beta»; un nombre descriptivo no se registra. **Rechazó**
    Zurrón/Alforja/Brújula/Guardabienes. Brief suyo para la 2ª ronda: subir de «bolsa donde guardar»
    a **crecer / patrimonio / horizonte / rumbo / progreso / legado**, y decidir si debe funcionar en
    inglés. ⚠ Ojo: esas palabras están muy usadas en marca financiera y son descriptivas = marca
    débil. Comprobar en Play + App Store + dominio + OEPM/EUIPO antes de proponer; **la elección es
    SUYA** y el registro lo confirma un agente de propiedad industrial.
23. Monetización/legal/gestor fiscal antes de cobrar → [[mi-cartera-escalado]].

---

# ✅ CERRADO EL 2026-08-04 (pendiente de su veredicto formal en el panel)
- **Saga de duplicados de TR** → [[tr-duplicados-saga]]. Él lo dio por bueno en caliente:
  «U,u ahora siiiiiii porfin!!!!! maravillaaaaa».
- Categorías **📈 Inversión** y **🔄 Traspaso** (esta última: se apunta y ancla «Mi ciclo», pero NO
  suma a ingresos — eligió él entre 3 opciones).
- **Ventana con 8 días de margen**: lo del último día del mes ya no se tira (su traspaso de 1.620 €
  del 31/7 y el bizum del piso de 70 €).
- **Ajustes → «Importaciones»** (hoja de Excel + histórico juntos) y fuera el exportar/importar JSON
  a mano. ← esto cierra una de las quejas de su veredicto del 3/8.

# 📌 Datos que NO hay que volver a levantar
- Su histórico **empieza el 15 de junio de 2026**: cuando dijo «el filtro Todo solo llega al 18 de
  junio» **no era un bug**. Los gastos viven en la tabla `expenses` (no en `app_state`) y **no se
  podan por antigüedad**.
- **Enable Banking no manda NADA de Trade Republic** (todo `null` salvo importe/signo/fecha). No es
  arreglable con código.
- El **rebote de pestañas** es el mecanismo NATIVO del navegador — no hay curva propia que tocar.
- ~~El e2e `plan-swipe-segmento` falla de forma intermitente (flake conocido)~~ **NO ERA UN FLAKE**
  (4/8). Fallaba 1 de 6, una distinta en cada pasada: las pruebas daban por buena la llegada a Plan
  en cuanto la pestaña se marcaba activa, pero el carrusel sigue deslizándose 420 ms más, y la que
  pillaba el peor momento arrastraba a mitad de la transición. Ahora se espera a que el track esté
  QUIETO. Lección: **un e2e de gestos que falla «al azar» suele estar midiendo a destiempo, no
  mintiendo** — mirarlo antes de etiquetarlo como flake.
- ⚠ **Lo que NO se puede probar en el portátil:** inercia/momentum de scroll, rebote nativo y todo
  lo del compositor. Los toques sintéticos de CDP mueven el scroll solo mientras el dedo arrastra.
