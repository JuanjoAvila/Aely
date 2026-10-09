# PR44 · CLI de candidatas · port local26

Preparación del 9/10/2026 sobre main `a8f258deb641264561dd34f284be12b099ee72b8`.
Fuente histórica PR44 `2050ce327bc931510742c3c582a9faf36155da89`; se rescata únicamente
el criterio de sus mensajes. No se restaura su BACKLOG ni su diagnóstico original.

La existencia de una rama no acredita revisión ni entrega; su ausencia no impide
preparar un porte aislado ni descarta uno ya publicado. El CLI deja de anunciar
publicación inmediata o aprobación de la ronda entera a partir de la lista.
Conserva todas las condiciones y campos JSON de actor, identidad, historial, huella,
APK, Edge y entregaPendiente. No cambia la decisión ni persiste una aprobación.

## Oráculos preparados, todavía sin ejecutar

- Aprobada con rama: candidata pendiente de revisión y entrega.
- Aprobada sin rama: comprobar porte entregado o preparar uno aislado.
- Lista completa aprobada: no acredita aprobación del diff completo ni entrega.
- APK, Edge y ambas: superficie pendiente pese a existir una rama web; cero
  veredictos pendientes no se presenta como cero entregas pendientes.
- Rechazo propio frente a OK ajeno: no cambia la decisión del titular.
- Identidad ambigua: salida 2 indeterminada sin evaluar candidatas.
- Lista vacía: comprobar alcance y artefactos de cualquier promoción.

Se amplía `tests/listo-actor.test.mjs`, ya registrado, con nueve casos de texto.
El doble sustituye transporte Git y selección de tandas; las reglas de actor,
huella, historial y entrega siguen siendo las reales. No usa red ni credenciales
reales. `--source-ref` permite aplicar el mismo contrato a la fuente anterior.

## Dependencias y estado

La lectura recursiva del registro, incluidos los alcances históricos, identifica
33 tandas, 2.841 referencias de fichero y 29 paths únicos; las dependencias
transitivas del lector se buscan en los módulos00/01/08. Los cuatro paths del port
no aparecen en ese conjunto. Los únicos scripts declarados son beta-revisions y
beta-source-code; src, registro, catálogo, public, versiones y workflows no se editan.
Esto es una inspección de dependencias, no un cálculo de digests ni un build.
Antes de integrar deben compararse todas las revisiones y el catálogo generados
contra la base. Cualquier identidad diferente debe declararse y revisarse; no se
promueve como tooling inocuo ni se repina una referencia para ocultarla.

Fuente/parche preparados. Sintaxis, guardián, control histórico, privacidad,
frescura documental, build y auditoría de digests pendientes de lease del
coordinador; no hay commit, PR, CI ni publicación de este port. La PR44 conserva
su estado abierto. El brief saneado de conciliación sigue en el rescate documental
de coordinación y tiene un alcance independiente.
