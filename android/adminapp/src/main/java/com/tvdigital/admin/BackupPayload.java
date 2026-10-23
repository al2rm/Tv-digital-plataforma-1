package com.tvdigital.admin;

import org.json.JSONObject;
import java.nio.charset.StandardCharsets;

public final class BackupPayload {
    public static final int MAX_BYTES = 4 * 1024 * 1024;
    public final String name;
    public final byte[] bytes;

    public BackupPayload(String message) throws Exception {
        if (message == null || message.length() > MAX_BYTES * 2 + 2048) {
            throw new IllegalArgumentException("La copia supera el límite de 4 MB. Usa el panel desde el navegador.");
        }
        JSONObject envelope = new JSONObject(message);
        name = envelope.getString("name");
        if (!name.matches("tv-digital-backup-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json")
                || !"application/json".equals(envelope.getString("mime"))) {
            throw new IllegalArgumentException("Formato de copia no admitido.");
        }
        bytes = envelope.getString("json").getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_BYTES) {
            throw new IllegalArgumentException("La copia está vacía o supera los 4 MB.");
        }
        new JSONObject(new String(bytes, StandardCharsets.UTF_8));
    }
}
