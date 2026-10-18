package com.micartera.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** La web propone el momento; el ajuste táctil del sistema sigue mandando en ambos métodos. */
@CapacitorPlugin(name = "AelyHaptics")
public class AelyHapticsPlugin extends Plugin {
    @PluginMethod
    public void edge(PluginCall call) { play(call, true, 8); }

    @PluginMethod
    public void fill(PluginCall call) {
        Double requested = call.getDouble("durationMs", 0.0);
        int duration = requested == null || Double.isNaN(requested) || Double.isInfinite(requested) || requested <= 0 ? 0 : (int) Math.min(1200, requested);
        play(call, false, duration);
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

    private void play(PluginCall call, boolean edge, int duration) {
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
                        if (edge) effect = VibrationEffect.createOneShot(8, HapticPlan.EDGE_AMPLITUDE);
                        else {
                            HapticPlan.Wave wave = HapticPlan.waveform(duration);
                            effect = VibrationEffect.createWaveform(wave.timings, wave.amplitudes, -1);
                        }
                    } else if (selected == HapticPlan.Path.LOW_TICK) {
                        HapticPlan plan = HapticPlan.create(edge ? primitiveMs : duration, primitiveMs);
                        if (plan != null) {
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
            call.resolve(result);
        });
    }
}
