# Coordinación local: límite de cuatro horas

Orden humana ratificada el 9 de octubre de 2026: cada coordinador tiene una ventana UTC de cuatro horas. Mantener el objetivo anterior activo después del relevo duplicó la supervisión; el límite se aplica también cuando quedan CI, publicación o artefactos pendientes.

Preparar antes del plazo el estado verificable y un único chat sucesor. El sucesor puede leer y devolver el ACK durante esa preparación, pero no reclama el canal ni toca producto mientras el saliente siga siendo titular. El cierre `released:true` anterior precede siempre a la tarea y al claim de la generación siguiente; conservar el contrato de `docs/COORDINACION-AGENTES.md` y el helper existente.

Al finalizar las cuatro horas, el saliente congela producto nuevo y pausa su objetivo por esta orden humana permanente. Entrega todo lo pendiente, incluidos bloqueos y verificaciones sin terminar, al único sucesor. No conserva un objetivo activo esperando resultados ni supervisa o repite trabajo después de la transferencia. No declara logrado un objetivo incompleto para poder relevar.

La transferencia exige claim propio y ACK comprobados, un único coordinador canónico, ventana UTC propia del sucesor y retarget de la misma heartbeat con lectura posterior. Conservar cadencia y preferencias de notificación; no crear otra rutina. Los trámites administrativos que excepcionalmente excedan el plazo sirven solo para completar esa entrega y no amplían la ventana de trabajo.

El plazo del coordinador nunca libera una reserva de recursos: hacen falta salida terminal, streams completos, comprobación fresca y liberación expresa. Conservar WIP, pruebas ya concluidas y las barreras propias de móvil, APK, Edge, SQL y aceptación financiera. No convertir un resultado de CI o una preparación en una entrega.
