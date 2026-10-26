# SAVEDAT: abrir una copia antigua

Una edición de deuda guardada por B podía desaparecer cuando A abría una copia antigua:
el mantenimiento de arranque renovaba `_savedAt`, y el LWW elegía A aunque su GET hubiera
leído correctamente a B. CAS evitaba escribir sobre otra revisión, pero no corregía esa
elección de contenido. El repro utiliza dos contextos reales de React/SDK y reloj normal;
B cambia el día desde el formulario antes de abrir A. No se adelanta ningún sello.

`set(updater, edited=true)` conserva su ruta de reconciliación y persistencia tras el
commit. Los snapshots de presupuesto, inversión y saldo por cuenta, el alcance del widget, FX, logros y
el acuse de copia diaria pasan `false`: guardan el resultado sin fabricar una edición.
También lo hacen la adopción de estado remoto, el pull de gastos y sus acuses, incluido
`obAbsorbedRetry`. La lectura adopta el sello de la versión elegida por el LWW existente;
una edición local pendiente conserva el suyo. Los formularios, los cambios financieros
y la aportación mensual mantienen el sellado habitual. El no-op devuelve la misma referencia.

La prueba verifica importes de 4237, 120023 y 10011 céntimos, campos desconocidos, identidad
de usuario, otra cuenta aislada, recarga y edición offline que se sube por CAS al reconectar.
`persist-commit` conserva la separación de gastos y el volcado del estado comprometido.
Los tests de primera lectura, recuperación, ACK, metas y persistencia siguen siendo
regresiones necesarias: esta separación no sustituye sus guardas.

El original7258 estaba apilado sobre PR293 R2; ese estado se conserva como histórico.
El port actual usa R3, como se indica debajo, y PR294 queda pendiente de otra tarea. No modifica VERSION, catálogo, notas de versión,
límites ni backend. No resuelve el merge general de ediciones simultáneas ni corrige los
sellos ya inflados por clientes antiguos. Pruebas sintéticas locales no acreditan CI general,
integración, despliegue ni aceptación móvil; el dispositivo real permanece bloqueado.

## Port sobre R3

Base de este port: PR293 R3 privada b92976b1edcdea292ca8d88f8a61942b79fa95e7,
rebasada sin conflictos sobre beta164 ce5969d3b787ab2a98e736d2036b2c7626ff1d4f.
Se conserva la barrera de commit y las guardias ACK de R3. El test mantiene GET retenido
mas de cuatro segundos sin POST state_backups ni lastBackup nuevo; tras liberar GET
exige el backup del estado mezclado, su titular, sello y4237/120023/10011 céntimos.
Los resultados históricos anteriores pertenecen a7258 sobreR2; no prueban este port.
Los resultados exactos de verificación dirigida y Node entero se entregan en el informe separado;
los resultados históricos de la fuente original no acreditan este port.
