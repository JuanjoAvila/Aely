# Integración local26 — Navegación, Metas e Inicio

Estado: candidata local sin publicar. Fuente beta común 8dcc5ed39b6e212ba1e34a90b550685794ce0bd5. Las pruebas de cada unidad y las comprobaciones conjuntas se distinguen de CI, entrega servida y aceptación móvil.

| Unidad | Fuente revisada | PR |
|---|---|---|
| Indicador oculto | 70ffea58b515c333d76a33a34426f76d5476a6d9 | #190 |
| Editar reglas de Metas | 088229a9b8f96868ca774e98fa7343f986cb5056 | #188 |
| Significado de la gráfica | 24593dd252b02656f7fc0c2c4c70a54784114379 | #191 |

## Alcance y conservación

La unión conserva las tres identidades web exactas de las fuentes anteriores. Hay36 unidades: las33 previas y tres nuevas independientes. No se añaden alias, equivalencias ni referencias al HEAD. Los únicos códigos antiguos que cambian son el alta de reglas de Metas, que incorpora sus dos lectores reales de edición, y el contorno, cuya regla de movimiento reducido cambia realmente con el indicador. Las cinco tandas aprobadas99/100/101/102/106 conservan sus códigos.

Se conservan las223 entradas de notas anteriores y se añaden las tres candidatas en es/en/ca. Retiro candidato de cinco aprobadas99/100/101/102/106, sólo después de entrega real verificada el8/10 a20:11:50UTC: producción4.26.106, fuente b1ad23f34f2a94933e57246dfdf12c451f5360a1, publisher37830672506SUCCESS, ZIP62f1a481be263fe0f88d2387445b2b3940335d8bd7e34eba1bcbc3b78067521c. HTTP/ZIP/HTML/SW/catálogo/idiomas/recibos coinciden;33 códigos web y222 notas de producción. APK52/4.26.80 idéntica al blobGit y URL200, sin generar binario. Artefacto servido:1.317.882/359.047B min/gzip Node oficial,3 bloqueantes yDSN95B. El guardián de retiro compara las cinco huellas publicadas y todas las226 notas de la candidata: sólo cinco guiones retirados, pendientes y rechazadas intactas. La beta servida sigue106.1 hasta publicar esta candidata; aprobar y fusionar no equivale a entregar. Sin cambios Android, SQL, Edge, dependencias ni saldo/historial financieros ajenos a la edición prevista.

## Empaquetado conjunto

Minificador oficial, misma configuración sintética95B y sello109.99999: baseLF1.317.888/359.021 B; uniónLF1.321.799/360.194 B, delta+3.911/+1.173 B. En Windows los24 CR exteriores dan1.321.823/360.211 B. Topes1291/352 KiB, márgenes161/237 B y los mismos3 recursos bloqueantes. La configuración y el sello realmente servidos deben revalidarse antes de declarar entrega.

## Verificación pendiente

La sintaxis completa, idiomas, privacidad y parser del alcance pasan. La auditoría de identidad conjunta pasa. La suite Node conjunta ejecutó130 etapas:126 pasaron inicialmente, incluidas1.782 mutaciones de funciones y701 de datos. Tres fallos se resolvieron y sus guardianes completos pasaron por separado: lectorLF de AppState, Gitconfig vacío portable (29/29 historias) y ejecución de Bash con CLI ficticio fuera del sandbox. El espejo de memoria local abortó por privacidad sin escribir nada; el test del exportador con414 variantes sintéticas pasó. No se presenta la suite local entera como verde. Deno no se ejecutó localmente.

Las67 comprobaciones DOM conjuntas pasan:12 de Navegación,30 de edición de Metas,14 de gráfica y11 de estados vacíos. Sin skip/retry/flaky, con datos sintéticos y HTML congelado SHA256 bfad75b7b9176a3694c49c04f3919138acb944411f62bf12371fd0b5091cdda4. El primer intento temporal de servidor tuvo cwd incorrecto y devolvió404; terminó por timeout sin ejecutar casos de producto, y se corrigió la configuración antes del run67/67. CI exacta de Metas37829753579 SUCCESS:130 etapas Node,5 archivos Deno,914 funcionales/1 skip opt-in/13 rendimiento,0fail/flaky/retry. Navegación37831140414 SUCCESS:130 etapas Node,4 archivos Deno,895 funcionales,1 flaky (hist-visor:54),1 skip opt-in y13 rendimiento; se declara el reintento, no un run sin flakies. Gráfica37832631610 FAILURE: el caso botnav-esconder:144 no alcanza el fondo físico (22px frente a<=4, en ambos intentos); aparece además1 flaky en el aviso mensualEN. El caso queda resuelto en el focal causal descrito a continuación; la entrega requiere CI final del publicador. La configuración de prueba temporal y los ficheros minificados de investigación se retiraron; los JSON de evidencia permanecen fuera del repo.

El bloqueo de cancelación se reprodujo y se corrigió sólo en el test: el gesto original desplaza465px tanto en beta como en109; los máximos reales son469 y487px, de modo que la nota añade18px y deja22px sin recorrer. Ahora el dedo continúa dentro del viewport hasta observar el mismo borde de4px antes del mismo touchCancel, sin relajar las comprobaciones posteriores. Base y candidata pasan; un mutante de la decisión real de cancelación falla después de alcanzar487/487px y la restauración oficial pasa. Un worker, cero retries/skip/flaky. Runtime y gráfica congelados; la CI fallida original y el flaky mensualEN se conservan como evidencia. El publicador de la integración debe pasar la suite completa antes de servir artefactos.

El fallo ancestral Perfil→Ajustes→cerrar tiene una tarea independiente110; no se altera ese controlador en esta tanda. El rendimiento sostenido del móvil INC-2709-09 sigue abierto. Sin aceptación móvil ni APK nueva.

Después del retiro, el HTML sólo cambia el hash del catálogo: al restaurar el hash anterior se recupera exactamente el DOM comprobado SHA256bfad75b7b9176a3694c49c04f3919138acb944411f62bf12371fd0b5091cdda4. No cambian los cálculos ni renderizadores ya comprobados. Las cuatro puertas legacy se repararon y verificaron: puente5cfb20ced0a6b5cb70d7da9efbb930215291f83a, estable106/b1ad y espejo beta106.1/8dcc con ZIP/manifiestos exactos.

El primer publicador109 (37842275807, fuente dded70935ee341f5adaf0c45a9d212c5f402f2c6) terminó FAILURE antes de DOM y empaquetado: beta-veredictos falló en el fixture de99 con tandas vacías. El test mezclaba catálogo real109 con llamadas99: tras retirar99, el fallback offline incluye la cabeza109 y la ronda online<=99 la excluye. Se sustituye sólo ese escenario por catálogo sintético cerrado99vacía/98pendiente y oráculo literal; se conserva la exigencia de no resucitar todo ni borrar la pendiente. Runtime, códigos web y226 notas intactos. No se reintenta el SHA fallido.
El guardián completo y beta-tandas-vacias pasan; mutar en memoria la decisión real de betaTandas para resucitar el array vacío hace fallar este mismo escenario. Se retira el fichero temporal sin tocar public. Se clasifica beta-veredictos como CORE y se verifica el plan literal full/Node/Deno/Playwright: el push de esta reparación no puede empaquetar la unión con un recorte sólo Node después del fallo anterior.
