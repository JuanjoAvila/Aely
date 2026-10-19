package com.micartera.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/** La web propone el momento; el ajuste táctil del sistema sigue mandando en ambos métodos. */
@CapacitorPlugin(name = "AelyHaptics")
public class AelyHapticsPlugin extends Plugin {
    /* UX16 ronda 4: fuerza y duración las elige él en el ajustador de la web (beta). Sin ellas,
       los valores de la APK 58, así una web vieja sobre esta APK no cambia nada. */
    @PluginMethod
    public void edge(PluginCall call) {
        int amplitude = HapticPlan.clamp(intArg(call, "amplitude", HapticPlan.EDGE_AMPLITUDE), 1, 255);
        int duration = HapticPlan.clamp(intArg(call, "durationMs", HapticPlan.EDGE_MS), 1, HapticPlan.MAX_EDGE_MS);
        play(call, true, duration, amplitude, null);
    }

    @PluginMethod
    public void fill(PluginCall call) {
        // La onda llega hecha desde la web (sigue al trazo del anillo); si falta o no cuadra, la rampa de siempre.
        HapticPlan.Wave custom = customWave(call);
        Double requested = call.getDouble("durationMs", 0.0);
        int duration = requested == null || Double.isNaN(requested) || Double.isInfinite(requested) || requested <= 0 ? 0 : (int) Math.min(1200, requested);
        play(call, false, custom != null ? (int) HapticPlan.total(custom) : duration, HapticPlan.EDGE_AMPLITUDE, custom);
    }

    private static int intArg(PluginCall call, String key, int fallback) {
        Double value = call.getDouble(key, null);
        return value == null || Double.isNaN(value) || Double.isInfinite(value) ? fallback : (int) Math.round(Math.max(-1e6, Math.min(1e6, value)));
    }

    private static HapticPlan.Wave customWave(PluginCall call) {
        JSArray timings = call.getArray("timings", null), amplitudes = call.getArray("amplitudes", null);
        if (timings == null || amplitudes == null || timings.length() != amplitudes.length() || timings.length() > HapticPlan.MAX_STEPS) return null;
        long[] t = new long[timings.length()];
        int[] a = new int[amplitudes.length()];
        try {
            for (int i = 0; i < t.length; i++) { t[i] = timings.getLong(i); a[i] = amplitudes.getInt(i); }
        } catch (JSONException bad) { return null; }
        return HapticPlan.custom(t, a);
    }

    @SuppressWarnings("deprecation")
    private boolean allowed(View view) {
        return view != null && view.isHapticFeedbackEnabled() && view.isShown() && view.hasWindowFocus()
            && Settings.System.getInt(getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 0) != 0;
    }

    private String softFallback(View view) {
        // Si el motor no puede dar este toque muy suave, Android permite callar; sin toque fuerte.
        return Build.VERSION.SDK_INT >= 34 && allowed(view)
            && view.performHapticFeedback(HapticFeedbackConstants.SEGMENT_FREQUENT_TICK) ? "SOFT_TICK" : "NONE";
    }

    private void play(PluginCall call, boolean edge, int duration, int edgeAmplitude, HapticPlan.Wave custom) {
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            String path = "NONE";
            View view = null;
            boolean amplitude = false, lowTick = false;
            int primitiveMs = 0;
            try {
                view = getBridge().getWebView();
                if (duration > 0 && allowed(view)) {
                    Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
                    if (Build.VERSION.SDK_INT >= 33 && vibrator != null && vibrator.hasVibrator()) {
                        amplitude = vibrator.hasAmplitudeControl();
                        // Un fallo al consultar primitivas no debe descartar una onda ya soportada.
                        if (!amplitude) {
                            lowTick = vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_LOW_TICK);
                            if (lowTick) {
                                int[] durations = vibrator.getPrimitiveDurations(VibrationEffect.Composition.PRIMITIVE_LOW_TICK);
                                primitiveMs = durations.length == 0 ? 0 : durations[0];
                            }
                        }
                    }
                    HapticPlan.Path selected = edge ? HapticPlan.select(Build.VERSION.SDK_INT, true, amplitude, lowTick, primitiveMs)
                        : HapticPlan.selectFill(Build.VERSION.SDK_INT, true, amplitude);
                    VibrationEffect effect = null;
                    if (selected == HapticPlan.Path.WAVEFORM) {
                        if (edge) effect = VibrationEffect.createOneShot(duration, edgeAmplitude);
                        else {
                            HapticPlan.Wave wave = custom != null ? custom : HapticPlan.waveform(duration);
                            effect = VibrationEffect.createWaveform(wave.timings, wave.amplitudes, -1);
                        }
                    } else if (selected == HapticPlan.Path.LOW_TICK) {
                        HapticPlan plan = HapticPlan.create(edge ? primitiveMs : duration, primitiveMs);
                        if (plan != null) {
                            if (edge) plan.scales[0] = HapticPlan.scaleFor(edgeAmplitude);
                            VibrationEffect.Composition composition = VibrationEffect.startComposition();
                            for (int i = 0; i < plan.delays.length; i++)
                                composition.addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, plan.scales[i], plan.delays[i]);
                            effect = composition.compose();
                        }
                    }
                    if (effect != null && Build.VERSION.SDK_INT >= 33) {
                        vibrator.vibrate(effect, new VibrationAttributes.Builder().setUsage(VibrationAttributes.USAGE_TOUCH).build());
                        path = selected.name();
                    } else if (edge) path = softFallback(view);
                }
            } catch (RuntimeException ignored) {
                try { path = edge ? softFallback(view) : "NONE"; } catch (RuntimeException unavailable) { path = "NONE"; }
            }
            // Respuesta por llamada sin logs ni identificadores: la APK permite leer la ruta real.
            result.put("path", path);result.put("api", Build.VERSION.SDK_INT);
            result.put("amplitudeControl", amplitude);result.put("lowTick", lowTick);result.put("primitiveMs", primitiveMs);
            result.put("continuous", !edge && path.equals("WAVEFORM"));
            // La web pregunta esto para avisar de que la APK instalada aún no entiende el ajustador.
            result.put("tunable", true);
            call.resolve(result);
        });
    }
}
