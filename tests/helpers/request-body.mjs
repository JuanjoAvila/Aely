import fs from "node:fs";
import { transformSync } from "esbuild";
// Los arneses que quitan imports también deben cargar el lector real, sin sustituir
// su validación. El cierre evita colisiones con nombres de los helpers bancarios.
const source = fs.readFileSync(new URL("../../supabase/functions/_shared/request_body.ts", import.meta.url), "utf8");
export const requestBodyPrelude = "const readInput = (() => {\n"
  + transformSync(source, { loader: "ts", format: "esm" }).code.replace(/^export /gm, "")
  + "\nreturn readInput; })();\n";
