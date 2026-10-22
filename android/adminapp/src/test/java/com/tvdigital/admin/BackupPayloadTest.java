package com.tvdigital.admin;

import org.json.JSONObject;
import org.junit.Test;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class BackupPayloadTest {
    private String envelope(String name, String mime, String content) throws Exception {
        return new JSONObject().put("name", name).put("mime", mime)
                .put("json", content).toString();
    }
    @Test public void preservesJsonAndSpanishNames() throws Exception {
        String data = "{\"clientes\":[{\"nombre\":\"María\"}]}";
        BackupPayload backup = new BackupPayload(envelope("tv-digital-backup-2026-10-22.json", "application/json", data));
        assertEquals(data, new String(backup.bytes, StandardCharsets.UTF_8));
    }
    @Test public void rejectsPathsWrongMimeInvalidJsonAndMissingContent() throws Exception {
        assertThrows(Exception.class, () -> new BackupPayload(envelope("../secret.json", "application/json", "{}")));
        assertThrows(Exception.class, () -> new BackupPayload(envelope("tv-digital-backup-2026-10-22.json", "text/html", "{}")));
        assertThrows(Exception.class, () -> new BackupPayload(envelope("tv-digital-backup-2026-10-22.json", "application/json", "<html>error</html>")));
        assertThrows(Exception.class, () -> new BackupPayload("{\"name\":\"tv-digital-backup-2026-10-22.json\",\"mime\":\"application/json\"}"));
    }
    @Test public void refusesOversizedMessagesBeforeDecoding() {
        assertThrows(Exception.class, () -> new BackupPayload("x".repeat(BackupPayload.MAX_BYTES * 2 + 2049)));
    }
}
