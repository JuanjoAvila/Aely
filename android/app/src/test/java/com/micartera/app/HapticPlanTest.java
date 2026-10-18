package com.micartera.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class HapticPlanTest {
    @Test public void round3FillCeiling() {
        HapticPlan.Wave wave = HapticPlan.waveform(1100);
        long total = 0;
        for (int i = 0; i < wave.amplitudes.length; i++) {
            total += wave.timings[i];
            assertTrue("fill never exceeds soft edge", wave.amplitudes[i] > 0 && wave.amplitudes[i] <= 30);
        }
        assertEquals(1100,total);
        assertTrue("starts more softly than edge",wave.amplitudes[0] <= 5);
    }
    @Test public void round3EdgeBudget() {
        HapticPlan plan = HapticPlan.create(12,12);
        assertEquals(1,plan.scales.length);
        assertEquals(.25f,plan.scales[0],.001f);
    }
    @Test public void singlePrimitiveUsesEdgeBudget() {
        HapticPlan plan = HapticPlan.create(1100, 12);
        assertEquals(1,plan.scales.length);
        assertEquals(.25f, plan.scales[0], .001f);
    }
    @Test public void singlePrimitiveDoesNotTrainFill() {
        HapticPlan plan = HapticPlan.create(1100, 12);
        assertEquals(1, plan.delays.length);
        int total = 0;
        for (int delay : plan.delays) { assertTrue(delay >= 0); total += delay + 12; }
        assertEquals(12, total);
        assertEquals(.25f, plan.scales[0], .001f);
    }
    @Test public void capsDurationAndCountAcrossMotorDurations() {
        for (int duration : new int[]{1,10,200,1100,1200,5000,Integer.MAX_VALUE}) {
            for (int primitive : new int[]{1,6,20,100,400,1200,2000}) {
                HapticPlan plan = HapticPlan.create(duration, primitive);
                if (primitive > Math.min(1200, duration)) { assertNull(plan); continue; }
                assertNotNull(plan);assertEquals(1,plan.delays.length);
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
    @Test public void waveformBudget() {
        for (int duration : new int[]{1,2,8,11,12,40,1100,1200,5000,Integer.MAX_VALUE}) {
            HapticPlan.Wave wave = HapticPlan.waveform(duration);
            long sum = 0;
            assertTrue(wave.timings.length <= 60);
            for (int i = 0; i < wave.timings.length; i++) {
                assertTrue(wave.timings[i] > 0);sum += wave.timings[i];
                assertTrue(wave.amplitudes[i] >= 3 && wave.amplitudes[i] <= 30);
                if (i > 0) assertTrue(wave.amplitudes[i] >= wave.amplitudes[i-1]);
            }
            assertEquals(Math.min(1200,duration),sum);
            assertEquals(3,wave.amplitudes[0]);
            if (duration > 1) assertEquals(30,wave.amplitudes[wave.amplitudes.length-1]);
        }
        assertNull(HapticPlan.waveform(0));assertNull(HapticPlan.waveform(-1));
    }
    @Test public void round3ContinuousChoice() {
        assertEquals(HapticPlan.Path.WAVEFORM,HapticPlan.selectFill(36,true,true));
        assertEquals(HapticPlan.Path.NONE,HapticPlan.selectFill(36,true,false));
        assertEquals(HapticPlan.Path.NONE,HapticPlan.selectFill(36,false,true));
        assertEquals(HapticPlan.Path.NONE,HapticPlan.selectFill(32,true,true));
    }
    @Test public void round3RampSampling() {
        HapticPlan.Wave wave=HapticPlan.waveform(1100);
        assertEquals(60,wave.timings.length);
        assertEquals(3,wave.amplitudes[0]);assertEquals(30,wave.amplitudes[59]);
        for(int i=0;i<60;i++) {
            assertTrue(wave.timings[i]>0 && wave.timings[i]<=20);
            if(i>0) assertTrue(wave.amplitudes[i]>=wave.amplitudes[i-1] && wave.amplitudes[i]-wave.amplitudes[i-1]<=1);
        }
    }
}
