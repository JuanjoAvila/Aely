import fs from "node:fs";
import { transformSync } from "esbuild";
const source = fs.readFileSync(new URL("../../supabase/functions/_shared/request_body.ts", import.meta.url), "utf8");
export const input = await import("data:text/javascript;base64," + Buffer.from(transformSync(source, { loader: "ts", format: "esm" }).code).toString("base64"));
