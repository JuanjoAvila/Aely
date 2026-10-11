# Inicio v4.2: cierre ligero del desbloqueo

Encargo `inicio-v42-desbloqueo-codex-20261011`, desde el candidato
`38aea2efb3efa92eb9735a34e47f3a1d6c7e741b` de PR204. Esta fase conserva
la entrega bloqueada anterior y prepara código local para el turno de máquina.

La serie agrupa el formateo de fechas por hora únicamente cuando ambos extremos
pertenecen al mismo día civil de Madrid. Las horas que atraviesan medianoche
conservan el formateo por movimiento. La acumulación diaria evita crear otro
array de 20.000 objetos. Una referencia independiente contrasta cada cierre en
ambos cambios horarios, con importes positivos y negativos y el total final exacto.
`netWorthDebtPolicy` reúne en un punto los dos criterios provisionales: deuda
actual constante y cuotas vinculadas neutras, pendientes de confirmación del dueño.

Se retiran el Sparkline antiguo sin llamadas, su CSS, diez claves de traducción
sin uso por idioma, el pie del ciclo sustituido y el helper `dashOrderOf` sin llamadas.
El smoke verifica la ausencia de la racha retirada por el diseño 3b y la presencia
del estado del ciclo. Su DOM todavía requiere ejecución en navegador.

Los guardianes de auth y veredictos mantienen las fuentes históricas junto a sus
descriptores históricos. La partición del historial exige identidad nueva y no
hereda aprobaciones antiguas. El descriptor vigente `inicio-grafica-vuelve` y sus
mutantes se actualizan en un commit técnico separado, sin repinar alias ni notas.

## Comprobaciones ligeras

Build, sintaxis, lógica Inicio en UTC y Europe/Madrid, auth-disposal,
beta-veredictos, i18n, mapa y beta-sources **sólo con `--inicio-v42-only`** terminan
con salida 0. No se acredita la suite completa de beta-sources ni npm ni navegador.
La atribución Node compara la misma serie sintética de 20.000 movimientos contra
38aea2ef: 20.201 llamadas de formato frente a 9.803. No acredita FPS ni sustituye
la comparación requerida contra beta684 con CPU ×6 y tres pasadas estables.

Medición LF, esbuild oficial sin renombrar identificadores y gzip nivel 9:

| Fuente | Minificado | Gzip | Con reserva de publicación, min/gzip |
| --- | ---: | ---: | ---: |
| Beta684 | 1.324.985 B | 361.834 B | 1.325.091 / 361.875 B |
| Candidato38 | 1.342.460 B | 366.653 B | 1.342.566 / 366.704 B |
| Cierre ligero | 1.340.391 B | 366.357 B | 1.340.497 / 366.413 B |

El corte reduce 2.069 B minificados y 296 B gzip respecto a38. Con el mismo sello
de versión `.99999` y reserva sintética de configuración de95 B, permanece un
exceso de **14.417 B minificados y 3.917 B gzip** sobre los límites existentes
de1.326.080 y362.496 B. Siguen tres recursos bloqueantes. Los topes no se cambian.

## Pendiente antes de entregar

Claude mantiene reservado el runner. No se ha iniciado Playwright, npm completo,
Gradle ni una prueba CPU ×6 en esta fase. Se necesita liberación expresa y turno
posterior a Widget; el grant anterior ya cerrado no autoriza estas ejecuciones.
Módulo11 sigue intacto y no se rebasa sobre una beta supuesta. Las causas de
Bienes y Metas contra beta684, PR203, rendimiento y suites completas siguen
pendientes. Los resultados Node son de esta fuente local y no acreditan otra
revisión ni aceptación móvil. No hay publicación ni integración de este cierre.
