package com.tvdigital.admin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.function.LongSupplier;

/** Private, bounded temporary payload; survives activity/process recreation during the picker. */
public final class PendingBackupStore {
    private static final int MAX_FILE_BYTES = BackupPayload.MAX_BYTES * 2 + 8192;
    private final File pending;
    private final File staging;
    private final LongSupplier clock;
    public PendingBackupStore(File privateDirectory) { this(privateDirectory, System::currentTimeMillis); }
    PendingBackupStore(File privateDirectory, LongSupplier clock) {
        this.clock = clock;
        pending = new File(privateDirectory, "pending-admin-backup.json");
        staging = new File(privateDirectory, "pending-admin-backup.tmp");
    }
    public synchronized boolean hasPending() {
        if (!pending.isFile()) return false;
        long age = clock.getAsLong() - pending.lastModified();
        if (age < 0 || age > 3600000 || pending.length() > MAX_FILE_BYTES) { clear(); return false; }
        return true;
    }
    public synchronized void save(String message) throws Exception {
        new BackupPayload(message);
        byte[] data = message.getBytes(StandardCharsets.UTF_8);
        if (data.length > MAX_FILE_BYTES) throw new IOException("Copia demasiado grande");
        if (hasPending()) throw new IOException("Ya existe una copia pendiente");
        try {
            try (FileOutputStream out = new FileOutputStream(staging)) {
                out.write(data);
                out.getFD().sync();
            }
            if (!staging.renameTo(pending)) throw new IOException("No se pudo preparar el archivo privado");
            if (!pending.setLastModified(clock.getAsLong())) throw new IOException("No se pudo fechar la copia");
        } catch (Exception error) { clear(); throw error; }
    }
    public synchronized BackupPayload read() throws Exception {
        if (!hasPending()) return null;
        try (FileInputStream input = new FileInputStream(pending);
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int size;
            while ((size = input.read(buffer)) != -1) {
                if (bytes.size() + size > MAX_FILE_BYTES) throw new IOException("Copia demasiado grande");
                bytes.write(buffer, 0, size);
            }
            return new BackupPayload(bytes.toString(StandardCharsets.UTF_8.name()));
        } catch (Exception error) { clear(); throw error; }
    }
    public synchronized void clear() {
        pending.delete();
        staging.delete();
    }
}
