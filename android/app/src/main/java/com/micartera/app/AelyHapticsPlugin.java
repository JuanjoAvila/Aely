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
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** La web propone el momento; el ajuste táctil del sistema sigue mandando en ambos métodos. */
@CapacitorPlugin(name = "AelyHaptics")
public class AelyHapticsPlugin extends Plugin {
    private void tick(View view) {
        view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);
    }

    @PluginMethod
    public void edge(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                View view = getBridge().getWebView();
                if (view != null) tick(view);
            } catch (RuntimeException ignored) {}
            call.resolve();
        });
    }

    @PluginMethod
    public void fill(PluginCall call) {
        Double requested = call.getDouble("durationMs", 0.0);
        getActivity().runOnUiThread(() -> {
            try {
                View view = getBridge().getWebView();
                if (view == null || requested == null || Double.isNaN(requested) || Double.isInfinite(requested) || requested <= 0) {
                    call.resolve();
                    return;
                }
                int duration = (int) Math.min(1200, requested);
                if (!compose(view, duration)) tick(view);
            } catch (RuntimeException ignored) {}
            call.resolve();
        });
    }

    @SuppressWarnings("deprecation")
    private boolean compose(View view, int duration) {
        if (Build.VERSION.SDK_INT < 33) return false;
        // USAGE_TOUCH respeta intensidad táctil; tampoco saltamos la opción propia de la View.
        if (!view.isHapticFeedbackEnabled() || !view.isShown() || !view.hasWindowFocus()) return true;
        try {
            if (Settings.System.getInt(getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 0) == 0) return true;
            Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            int primitive = VibrationEffect.Composition.PRIMITIVE_LOW_TICK;
            if (vibrator == null || !vibrator.hasVibrator() || !vibrator.areAllPrimitivesSupported(primitive)) return false;
            int[] durations = vibrator.getPrimitiveDurations(primitive);
            HapticPlan plan = HapticPlan.create(duration, durations.length == 0 ? 0 : durations[0]);
            if (plan == null) return false;
            VibrationEffect.Composition composition = VibrationEffect.startComposition();
            for (int i = 0; i < plan.delays.length; i++) {
                composition.addPrimitive(primitive, plan.scales[i], plan.delays[i]);
            }
            vibrator.vibrate(composition.compose(), new VibrationAttributes.Builder().setUsage(VibrationAttributes.USAGE_TOUCH).build());
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }
}
