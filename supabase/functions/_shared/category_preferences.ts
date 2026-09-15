// Solo preferencias de clasificación del titular. No hace falta descargar su cartera,
// y una caché global podría aplicar las reglas de una persona a la siguiente petición.
// deno-lint-ignore no-explicit-any
export async function readCategoryOverrides(client: any, userId: string): Promise<{
  rules: Record<string, unknown> | undefined; unavailable: boolean;
}> {
  try {
    const { data, error } = await client.from("app_state")
      .select("rules:data->catOverrides").eq("user_id", userId).maybeSingle();
    if (error) return { rules: undefined, unavailable: true };
    const rules = data?.rules;
    if (rules == null) return { rules: undefined, unavailable: false };
    // Un estado dañado no debe consumir recursos sin límite ni impedir guardar el movimiento.
    if (typeof rules !== "object" || Array.isArray(rules) || Object.keys(rules).length > 2000 ||
        new TextEncoder().encode(JSON.stringify(rules)).byteLength > 131072) return { rules: undefined, unavailable: true };
    return { rules, unavailable: false };
  } catch (_) {
    return { rules: undefined, unavailable: true };
  }
}
