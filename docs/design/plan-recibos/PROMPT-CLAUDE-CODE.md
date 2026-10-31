# Prompt para Claude Code · Plan Recibos v6

Pegar tal cual en una sesión nueva de Claude Code sobre el repo `JuanjoAvila/Aely`.

---

Vamos a implementar el rediseño de **Plan › Recibos** que cerré en diseño. Todo está en
`docs/design/plan-recibos/` (rama `claude/plan-recibos-b-diseno`):

- `SPEC.md` — fuente de verdad. Empieza por el §0 (mapa con el código de hoy) y el §12 (descartado).
- `prototipo-plan.dc.html` — prototipo interactivo aprobado. Úsalo para medidas, textos, animaciones
  y comportamiento de gestos. **No es código para copiar** y sus datos son inventados.

Reglas:

1. Lee `AGENTS.md` entero antes de tocar nada y síguelo (fuente única en `src/modules`, sin JSX,
   es/en/ca, e2e por lista + `E2E_MAP`, sin restos, canal beta, nada directo a `main`).
2. Ve **por tandas en el orden del §15 de la SPEC**, una tanda por PR a beta. Empieza por la
   **tanda 1** (pantalla principal + ficha + «¿Cuál es el cargo?»). Al acabar cada tanda, para,
   resúmeme qué ha cambiado y cómo probarlo en el móvil, y espera mi OK para la siguiente.
3. **Reutiliza lo que ya hay** (§0): `planChargesMonth`, `fixedPaymentState`, `linkFixedPayment`,
   `quitarCargoDeRecibo`, `BillsAddWizard`, `BillsManagePush`, `useTironSeccion`, `minByBank`,
   `amount`/`bankAmount`. No dupliques lógica de casado ni de saldos.
4. **Nunca inventes una cifra**: si falta un dato, «—». Moneda siempre de `DISP.sym`.
5. Antes de añadir campos nuevos al modelo (`fixed[]`, personas, pausa, prueba, permanencia) o tocar
   Supabase / `pg_cron`, **pregúntame** con la propuesta concreta. Lo mismo con el ojo de ocultar
   importes (§8) y con los enlaces de baja (§2.6.2: solo URLs verificadas).
6. **Cartera no se toca.** Ni Gastos v5, salvo lo compartido (`useTironSeccion`) y sin cambiar su
   comportamiento.
7. Lo del §12 no se hace aunque parezca buena idea.
8. Mide en móvil con CPU estrangulada (AGENTS §7 bis) los gestos de deslizar filas y cerrar hojas.

Si algo de la SPEC choca con cómo funciona la app de verdad, dímelo antes de decidir tú.
