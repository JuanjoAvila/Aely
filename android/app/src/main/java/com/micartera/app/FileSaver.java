package com.micartera.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Guardar un fichero que genera la web (el informe del mes) donde la persona lo encuentra.
 *
 * Hasta la APK 64 la web hacía `<a download>` con una URL `blob:`. En la WebView de Capacitor eso
 * no hace NADA —no hay DownloadListener, y aunque lo hubiera, DownloadManager no sabe leer un
 * `blob:`—, pero la web decía «guardado en Descargas» igual: «en la carpeta donde se supone que se
 * guarda no hay nada» (19/11/2026). Ahora los bytes cruzan el puente y se escriben aquí.
 *
 * Android 10+ (API 29): MediaStore.Downloads con RELATIVE_PATH = Download. Sin permisos de
 * almacenamiento: una app puede crear ficheros suyos en Descargas sin pedir nada.
 * Android 6–9: escribir en Descargas pediría WRITE_EXTERNAL_STORAGE, que no queremos; se guarda en
 * la carpeta de la app (`Android/data/…/files/Download`) y se abre por FileProvider. La web lo
 * sabe por `inDownloads` y no promete «Descargas».
 */
final class FileSaver {
    private FileSaver() {}

    static final class Saved {
        final Uri uri;
        final String name;
        final boolean inDownloads;
        Saved(Uri uri, String name, boolean inDownloads) { this.uri = uri; this.name = name; this.inDownloads = inDownloads; }
    }

    /** Nombre seguro: sin rutas ni caracteres que MediaStore o FAT rechazan. Vacío → fallback. */
    static String safeName(String raw, String fallback) {
        String s = raw == null ? "" : raw.trim();
        int slash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (slash >= 0) s = s.substring(slash + 1);
        s = s.replaceAll("[\\x00-\\x1f:*?\"<>|]", "_");
        while (s.startsWith(".")) s = s.substring(1);
        if (s.length() > 120) s = s.substring(s.length() - 120);
        return s.isEmpty() ? fallback : s;
    }

    /** Quita el prefijo `data:…;base64,` si la web manda un data URL entero. */
    static String stripDataUrl(String data) {
        if (data == null) return "";
        int comma = data.startsWith("data:") ? data.indexOf(',') : -1;
        return comma >= 0 ? data.substring(comma + 1) : data;
    }

    static Saved save(Context ctx, String name, String mime, byte[] bytes) throws IOException {
        if (Build.VERSION.SDK_INT >= 29) return saveMediaStore(ctx, name, mime, bytes);
        File dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) dir = new File(ctx.getFilesDir(), "Download");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        File f = new File(dir, name);
        try (FileOutputStream out = new FileOutputStream(f)) { out.write(bytes); }
        Uri uri = androidx.core.content.FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
        return new Saved(uri, name, false);
    }

    private static Saved saveMediaStore(Context ctx, String name, String mime, byte[] bytes) throws IOException {
        ContentResolver cr = ctx.getContentResolver();
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        // Pendiente mientras se escribe: así la galería no enseña un PNG a medias.
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
        if (uri == null) throw new IOException("MediaStore no devolvió URI");
        try (OutputStream out = cr.openOutputStream(uri)) {
            if (out == null) throw new IOException("sin flujo de escritura");
            out.write(bytes);
        } catch (IOException | RuntimeException e) {
            try { cr.delete(uri, null, null); } catch (Exception ignored) {}
            throw e;
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.MediaColumns.IS_PENDING, 0);
        cr.update(uri, done, null, null);
        // Si ya había uno con ese nombre, MediaStore lo renombra («… (1).png»): se devuelve el real
        // para que el aviso diga el nombre que la persona verá en Descargas.
        String shown = name;
        try (Cursor c = cr.query(uri, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) shown = c.getString(0);
        } catch (Exception ignored) {}
        return new Saved(uri, shown, true);
    }
}
