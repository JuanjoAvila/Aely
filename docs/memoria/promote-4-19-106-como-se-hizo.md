<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (promote-4-19-106-como-se-hizo.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: promote-4-19-106-como-se-hizo
description: "Cómo se subió la ronda 4.19 a prod el 13/9 sin comerse main — merge -s ours tras portar, [skip ci] para no desplegar Edge de golpe, nota única, puente, Edge una a una"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7fd7cd78-dc13-40b7-b03e-17cda8686805
  modified: 2026-09-13T18:46:55.494Z
---

13/9/2026: producción pasó de 4.18.25 a **4.19.106** (main = beta = `a5c885ab`). Él pidió «una nota de todo lo que sube, no 818138218 notas» y «revisad que no rompe nada».

Lo que funcionó y hay que repetir:
1. **main tenía 53 commits que beta no** (arreglos 4.18.19–25). Mezcla de prueba local = 44 conflictos. `promote-beta.yml` con `-X theirs` se los habría comido. Se comprobó commit a commit qué faltaba en beta (casi todo eran «portar X», ya en beta), se portaron los 3 que faltaban, y luego `git merge -s ours origin/main` → main hace fast-forward.
2. **`supabase.yml` salta con push a main si cambia `supabase/**`**: desplegaría las 13 funciones + `db push` de golpe con la familia aún en la versión vieja. Se empujó con un commit vacío `[skip ci]` y se lanzó `deploy.yml` a mano.
3. **Nota única**: en el JSON de prod, una entrada nueva + el historial de main, todas con `tandas:[]` (sin la propiedad, el panel las resucita como «/todo»). Guardianes del panel (`beta-tandas-vacias`, `release-notes-max`, e2e `revisar-beta`) asumían ronda viva: ahora solo comprueban si la hay.
4. **Puente `JuanjoAvila/Mi-Cartera`**: copiar `version.json`, `bundle.zip` y `apk.json` de /Aely/ y comprobar /Mi-Cartera/ por contenido. No lo hace ningún workflow.
5. **Edge después**, de una en una (`workflow_dispatch funcion=X migraciones=no`), con su OK. Qué está atrasado se sabe por el SHA de cada run de «Deploy Supabase» + los imports de cada index.ts, no por fechas ([[servidor-al-dia-compara-fechas]]).

14/9: repetido con **4.20.4** (FF limpio, nota única, `[skip ci]`, migraciones 0022/0023 con `supabase.yml -f funcion=categorize -f migraciones=si` DESPUÉS de que Pages sirva el cliente). Tras cada promote él pide **resetear la numeración de beta** (4.19.107 → 4.20.0; tras 4.20.4 → 4.21.0).

**Why:** cada promote anterior fue un cristo ([[promote-cada-cristo]], [[promote-merge-theirs]]).
**How to apply:** en el próximo promote, repetir 1–5 en ese orden. Ojo: Cursor dejó `build.gradle` con mojibake (Set-Content) en un porte — revisar `grep Ã` en todo diff de Cursor ([[feedback-nunca-editar-con-powershell]]). Y dos agentes llegaron a editar el MISMO worktree: decir por el buzón de quién es cada worktree.
