package com.micartera.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class HapticPlanTest {
    @Test public void round2LowPrimitiveBudget() {
        HapticPlan plan = HapticPlan.create(1100, 12);
        assertEquals(.04f, plan.scales[0], .001f);
        assertEquals(.16f, plan.scales[9], .001f);
        for (float scale : plan.scales) assertTrue(scale > 0 && scale <= .161f);
    }
    @Test public void includesPrimitiveDurationAndSpansRing() {
        HapticPlan plan = HapticPlan.create(1100, 12);
        assertEquals(10, plan.delays.length);
        int total = 0;
        for (int delay : plan.delays) { assertTrue(delay >= 0); total += delay + 12; }
        assertEquals(1100, total);
        assertEquals(.04f, plan.scales[0], .001f);
        assertEquals(.16f, plan.scales[9], .001f);
        for (int i = 1; i < 10; i++) assertTrue(plan.scales[i] > plan.scales[i-1]);
    }
    @Test public void capsDurationAndCountAcrossMotorDurations() {
        for (int duration : new int[]{1,10,200,1100,1200,5000,Integer.MAX_VALUE}) {
            for (int primitive : new int[]{1,6,20,100,400,1200,2000}) {
                HapticPlan plan = HapticPlan.create(duration, primitive);
                if (primitive > Math.min(1200, duration)) { assertNull(plan); continue; }
                assertNotNull(plan);assertTrue(plan.delays.length <= 10);
                int total = 0;
                for (int delay : plan.delays) { assertTrue(delay >= 0); total += delay + primitive; }
                assertTrue(total <= Math.min(1200, duration));
            }
        }
    }
    @Test public void invalidOrUnknownDurationsRequireFallback() {
        assertNull(HapticPlan.create(0, 12));assertNull(HapticPlan.create(-1, 12));
        assertNull(HapticPlan.create(1100, 0));assertNull(HapticPlan.create(1100, -1));
        assertNull(HapticPlan.create(8, 12));
    }
    @Test public void round2PathCapabilities() {
        assertEquals(HapticPlan.Path.WAVEFORM, HapticPlan.select(36,true,true,true,12));
        assertEquals(HapticPlan.Path.WAVEFORM, HapticPlan.select(36,true,true,false,0));
        assertEquals(HapticPlan.Path.LOW_TICK, HapticPlan.select(36,true,false,true,12));
        assertEquals(HapticPlan.Path.SOFT_TICK, HapticPlan.select(36,true,false,false,0));
        assertEquals(HapticPlan.Path.SOFT_TICK, HapticPlan.select(36,true,false,true,0));
        assertEquals(HapticPlan.Path.NONE, HapticPlan.select(36,false,true,true,12));
        assertEquals(HapticPlan.Path.NONE, HapticPlan.select(32,true,true,true,12));
        assertEquals(HapticPlan.Path.NONE, HapticPlan.select(33,true,false,false,0));
        assertEquals(HapticPlan.Path.LOW_TICK, HapticPlan.select(33,true,false,true,12));
    }
    @Test public void round2WaveformBudget() {
        for (int duration : new int[]{1,2,8,11,12,40,1100,1200,5000,Integer.MAX_VALUE}) {
            HapticPlan.Wave wave = HapticPlan.waveform(duration);
            long sum = 0;
            assertTrue(wave.timings.length <= 12);
            for (int i = 0; i < wave.timings.length; i++) {
                assertTrue(wave.timings[i] > 0);sum += wave.timings[i];
                assertTrue(wave.amplitudes[i] >= 10 && wave.amplitudes[i] <= 60);
                if (i > 0) assertTrue(wave.amplitudes[i] >= wave.amplitudes[i-1]);
            }
            assertEquals(Math.min(1200,duration),sum);
            assertEquals(10,wave.amplitudes[0]);
            if (duration > 1) assertEquals(60,wave.amplitudes[wave.amplitudes.length-1]);
        }
        assertNull(HapticPlan.waveform(0));assertNull(HapticPlan.waveform(-1));
    }
}
