package com.tvdigital.admin;

import java.util.function.LongSupplier;

/** A native menu action permits exactly one export response for at most 45 seconds. */
public final class BackupRequestGate {
    private final LongSupplier clock;
    private long deadline = -1;
    public BackupRequestGate(LongSupplier clock) { this.clock = clock; }
    public boolean begin() {
        if (active()) return false;
        deadline = clock.getAsLong() + 45000;
        return true;
    }
    public boolean active() { return deadline >= 0 && clock.getAsLong() < deadline; }
    public boolean consume() { boolean accepted = active(); cancel(); return accepted; }
    public void cancel() { deadline = -1; }
}
