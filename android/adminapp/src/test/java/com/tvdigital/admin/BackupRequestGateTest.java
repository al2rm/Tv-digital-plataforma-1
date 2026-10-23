package com.tvdigital.admin;

import org.junit.Test;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.Assert.*;

public class BackupRequestGateTest {
    @Test public void rejectsUnsolicitedAndReplayedMessages() {
        BackupRequestGate gate = new BackupRequestGate(() -> 100);
        assertFalse(gate.consume());
        assertTrue(gate.begin());
        assertFalse(gate.begin());
        assertTrue(gate.consume());
        assertFalse(gate.consume());
    }
    @Test public void expiresAndCancelsRequestsOnNavigation() {
        AtomicLong time = new AtomicLong(100);
        BackupRequestGate gate = new BackupRequestGate(time::get);
        assertTrue(gate.begin());
        time.addAndGet(45001);
        assertFalse(gate.consume());
        assertTrue(gate.begin());
        gate.cancel();
        assertFalse(gate.consume());
    }
}
