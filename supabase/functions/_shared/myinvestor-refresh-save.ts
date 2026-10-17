type MiSnapshot = {
  user_id: string;
  connection_version?: string;
  access_token?: string | null;
  refresh_token?: string | null;
};
type MiTokenPatch = {
  access_token: string | null;
  refresh_token: string | null;
};

// Un refresh consume una credencial fuera de la BD. Repetir sólo el MISMO guardado
// permite recuperar un acuse perdido sin consumir otro token ni pisar otra rotación.
export async function miSaveRefresh(
  // deno-lint-ignore no-explicit-any
  admin: any,
  snapshot: MiSnapshot,
  patch: MiTokenPatch & Record<string, unknown>,
  sameRefresh: boolean,
): Promise<"saved" | "raced" | "unknown"> {
  if (!snapshot.connection_version) return "unknown";
  let uncertain = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    let failed = false;
    try {
      const query = admin.from("myinvestor_links").update(patch)
        .eq("user_id", snapshot.user_id).eq(
          "connection_version",
          snapshot.connection_version,
        );
      if (snapshot.refresh_token == null) query.is("refresh_token", null);
      else query.eq("refresh_token", snapshot.refresh_token);
      if (sameRefresh) {
        if (snapshot.access_token == null) query.is("access_token", null);
        else query.eq("access_token", snapshot.access_token);
      }
      const { data, error } = await query.select("user_id");
      if (!error && data?.length) return "saved";
      failed = !!error;
    } catch {
      failed = true;
    }
    uncertain ||= failed;

    try {
      const { data: now, error } = await admin.from("myinvestor_links").select(
        "*",
      )
        .eq("user_id", snapshot.user_id).maybeSingle();
      if (error || !now) return "unknown";
      if (now.connection_version !== snapshot.connection_version) {
        return "raced";
      }
      // El patch se cifra UNA vez y se reutiliza byte a byte. Un nuevo IV aquí
      // impediría reconocer nuestra propia escritura después de perder el acuse.
      if (
        uncertain && now.access_token === patch.access_token &&
        now.refresh_token === patch.refresh_token &&
        (!Object.hasOwn(patch, "status") || now.status === patch.status)
      ) return "saved";
      if (
        now.refresh_token !== snapshot.refresh_token ||
        (sameRefresh && now.access_token !== snapshot.access_token)
      ) return "raced";
      // Cero filas sin error no confirma nada, aunque otra lectura no explique por qué.
      if (!failed) return "unknown";
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}
