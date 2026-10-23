package com.tvdigital.admin;

import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.Assert.*;

public class PendingBackupStoreTest {
    @Rule public TemporaryFolder directory = new TemporaryFolder();
    private String message() throws Exception {
        return new JSONObject().put("name", "tv-digital-backup-2026-10-23.json")
                .put("mime", "application/json").put("json", "{\"cliente\":\"María\"}").toString();
    }
    @Test public void anotherActivityInstanceCanRecoverThePreparedPayload() throws Exception {
        File root = directory.getRoot();
        PendingBackupStore first = new PendingBackupStore(root);
        first.save(message());
        PendingBackupStore recreated = new PendingBackupStore(root);
        assertTrue(recreated.hasPending());
        assertEquals("{\"cliente\":\"María\"}", new String(recreated.read().bytes, StandardCharsets.UTF_8));
        recreated.clear();
        assertFalse(first.hasPending());
        assertNull(recreated.read());
    }
    @Test public void expiresTemporaryPersonalDataAndDoesNotOverwritePendingExports() throws Exception {
        AtomicLong time = new AtomicLong(System.currentTimeMillis());
        PendingBackupStore store = new PendingBackupStore(directory.getRoot(), time::get);
        store.save(message());
        assertThrows(Exception.class, () -> store.save(message()));
        assertTrue(store.hasPending());
        time.addAndGet(3600001);
        assertFalse(store.hasPending());
        assertNull(store.read());
    }
    @Test public void invalidDataNeverBecomesAPendingFile() {
        PendingBackupStore store = new PendingBackupStore(directory.getRoot());
        assertThrows(Exception.class, () -> store.save("not-json"));
        assertFalse(store.hasPending());
    }
}
