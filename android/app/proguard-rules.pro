# Reglas de R8 para la APK de release (SEG-22, 19/11/2026).
#
# Por qué se enciende R8: sin él la APK lleva entero el código de las librerías (Guava, OkHttp,
# Play Core…) aunque no se use, y todo con sus nombres. Lo que se gana es quitar lo que sobra.
#
# Por qué NUESTRO código se deja tal cual (nombres y todo): el repo es público, así que ofuscarlo no
# esconde nada, y hay nombres que viven fuera de la APK y que un cambio de nombre rompería EN SILENCIO
# en los móviles que actualicen encima:
#   - WorkManager guarda en su base de datos el NOMBRE de la clase de cada trabajo periódico
#     (OtaCheckWorker, AlertCheckWorker). Si la clase pasara a llamarse «a.b», el trabajo que dejó la
#     APK anterior no encontraría su clase y el aviso de actualización con la app cerrada moriría.
#   - El puente JS de Trade Republic (`AndroidTR`, @JavascriptInterface) y los plugins de Capacitor
#     se buscan por nombre y por anotación.
-keep class com.micartera.app.** { *; }

# Capacitor ya trae reglas para sus plugins (consumerProguardFiles de capacitor-android), pero el
# puente JS de una WebView no es un plugin: que nadie dependa de la regla genérica por defecto.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*,JavascriptInterface

# El updater de Capgo busca androidx.webkit por reflexión (solo para estadísticas, que aquí van
# apagadas); si R8 lo renombrara, esa ruta fallaría sin más. Mejor que siga encontrándolo.
-keep class androidx.webkit.WebViewFeature { public *; }
-keep class androidx.webkit.WebViewCompat { public *; }

# Trazas legibles si algún día hay que leer un fallo del móvil (sin el nombre real del fichero).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
