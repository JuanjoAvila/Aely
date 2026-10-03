# Promoción web aprobada · 3 de octubre de 2026

Autorización humana directa de publicar en producción las tandas aprobadas, conservando pendientes e histórico. Candidata desde main12884f48 con fuente web beta86/49a219a7; excluye Metas87, Movilidad88 y el fix nativo de PR105. Veredictos actuales de un administrador único y sus identidades/código se cotejan por tanda antes de publicar; no se infiere aprobación de CI. Evidencia saneada en test-results, sin identidad personal ni credenciales.

La web contiene las veinte tandas de86. Los Java y TS ya revisados de esa fuente se conservan como fuente para mantener identidades; NO se compila ni publica APK ni se despliega Edge. APK estable48/version32 y su build.gradle permanecen exactos de main. El workflow Supabase manual de main y su guardián se conservan; no se recupera el disparo por push que sigue en la rama beta. Las tandas con APK/Edge pendientes mantienen sus requisitos; recibos web exactos no los sustituyen.

Todos los módulos web, shell, datos/notas, registro de alcances e idiomas proceden de49a. Veinte recibos web deben coincidir con la beta aprobada; no se repinan ni recortan alcances. Notas207 completas con el mismo orden; histórico de producción conservado. El despliegue Pages necesita historia Git completa para recalcular referencias de aprobación y ejecuta los mismos cuatro ficheros Deno que CI. Fuente nueva de producto no se añade a esta candidata.

Estado: candidata aislada, verificación local/CI/revisión del diff/merge/publicación real pendientes. Solo después de manifest/ZIP/HTML/SW/notas/recibos estables se atribuirá entrega y se podrá retirar una superficie del panel beta. El listado beta conserva las tandas cuyo requisito nativo/Edge no se ha entregado.

La comprobación de historia detectó que beta llevaba otro texto en66/67: se conservan sus notas públicas y todas las secciones ya publicadas del CHANGELOG de main. Dieciocho OK tienen huella actual idéntica; Arranque/Ayuda conservan dos veredictos antiguos sin huella únicamente mediante aliases fijados a auditoría Git verificada, mismo código y guion. No se inventa un alias nuevo.


Revisión del diff tras Node: se conservan íntegros los briefs de las entregas exclusivas FIN-06/07, Inicio66, OPS-02 y SEC-03 de main. Documentos conjuntos resueltos por ancestro común y revisión explícita; Release y Setup conservan Supabase manual y SQL opt-in. Pages descarga historia completa en ambos jobs. Node1384.3s completo solo falla memoria-espejo externo; Deno local omitido. DOM116PASS del mismo código web; estas correcciones posteriores solo afectan docs/workflow, requieren nuevoSHA yCI completa.
