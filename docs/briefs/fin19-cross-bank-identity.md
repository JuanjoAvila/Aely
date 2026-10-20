# FIN19 R2 · identidad local y borrado de gastos

Candidata de PR288 sobre beta 4.26.158, `a5bbecf6793931f4cfc8a3087951ad1ef66580f8`, 20/10/2026. Conserva R1 `8f87eadc4e6f018a2d50a33808ee0945f171876c` mediante merge normal. No acredita integración, entrega servida ni aceptación móvil. La revisión R1 fue NO-GO por duplicar identidades desconocidas y mantener lápidas demasiado amplias.

Solo se separan dos identidades con banco y cuenta conocidos y distintos. Sin uno de esos datos se conserva la agrupación por contenido de base. Un aviso N sin cuenta ocupa una sola ranura: N junto a dos cuentas conocidas A/B suma 640 céntimos, conserva el UUID local y las decisiones manuales de N, y deja otro cargo separado. El índice usa una elección estable entre candidatas; no escribe un banco ni una cuenta supuestos. El refresco conserva únicamente el enriquecido que ya hacía la base. Referencias inequívocas del mismo banco conservan su identidad entre lecturas; el fallback por contenido no cambia el banco de una referencia ni le crea otro ordinal.

La corrección se aplica a ambas mezclas, ordinales/referencias, preparación y ACK de categorías y contador del pull. Se conserva el índice UUID de PR286, sus guardas de campos y lápidas; un UUID compartido no permite colapsar cuentas conocidas distintas. No se cambia el backfill.

Las lápidas nuevas de una identidad completa usan `expense-account|identidad-codificada|clave-anterior`. Borrar, deshacer, editar y resolver duplicados emplean la misma clave. El lector reconoce el ámbito y el vínculo de referencia conserva signo y cuenta en diario e histórico. Una fila antigua sin cuenta puede seguir reconociendo el borrado por contenido compatible, sin ocultar otra cuenta conocida. El índice comparte la única pasada existente por las lápidas. Las lápidas antiguas ambiguas conservan su alcance anterior; no es posible reconstruir la cuenta que les faltaba. No hay conversión masiva ni reparación histórica. Se admite un vínculo nuevo junto a una lápida antigua. Las filas que siguen sin identidad completa mantienen el contrato anterior de borrado.

| Caso, céntimos | Base original | R1 rechazada | R2 |
|---|---:|---:|---:|
| Wallet sin banco + extracto | 320 | 640 | 320 |
| Aviso + dos cuentas | 640 | 960 | 640 |
| Legacy sin cuenta + nube con cuenta | 320 | 640 | 320 |
| Borrar uno de dos conocidos: restante visible | 0 | 0 | 320 |

Cuatro RED originales preservados; la ejecución que empezó antes de terminar el build se excluye de la evidencia causal. También se conserva una ejecución contra beta158 compilada. Las matrices contienen filas completas, ambos merges, órdenes, particiones y repeticiones. El borrado ejecuta callback real, filtro, `mcSaveRaw`/`mcLoadRaw`, pull y undo, con cuentas del mismo banco y de bancos distintos.

409 pruebas dirigidas pasan en un lote final y una prueba adicional de referencias de lápidas pasa por separado: 410 reportadas, concurrencia 1, datos sintéticos. Incluyen PR286, FIN10/11/15, pendientes/BOOK, absorciones, referencias/ordinales, devoluciones, categorías, emparejado y pulls. Mutantes nuevos restauran los tres sobreconteos, omiten banco/cuenta, amplían el borrado o permiten resurrección; todos son detectados. Fallos intermedios y EXIT conservados.

Sintaxis, privacidad, seguridad y mapa de tests: EXIT 0. Tamaño: EXIT 1 en minificado y gzip; no se suben topes. Docs y catálogo se registran con su resultado efectivo en la entrega. VERSION, notas y catálogo quedan a cargo de integración, conforme al encargo.

El lector servidor y la unicidad de la tabla conservan sus reglas: esta corrección local no acredita convergencia completa entre superficies ni recupera filas ya perdidas. Sin nube/banco reales, SQL, Edge, APK, navegador, CPU6, suite completa, despliegue, merge de PR ni aceptación móvil. No ProductREADY.
