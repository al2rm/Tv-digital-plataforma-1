package com.tvdigital.admin;

import org.junit.Test;
import static org.junit.Assert.*;

public class PanelPolicyTest {
    @Test public void normalizesAndPinsOrigin() {
        PanelPolicy policy = new PanelPolicy("  https://PANEL.example:443/  ");
        assertEquals("https://panel.example/", policy.home);
        assertTrue(policy.owns("https://panel.example/usuarios?page=2"));
        assertTrue(policy.owns("https://panel.example:443/"));
        for (String target : new String[]{"http://panel.example/", "https://panel.example.evil/", "https://panel.example:8443/", "https://other.example/", "https://user@panel.example/", "javascript:alert(1)", "file:///etc/passwd", null}) {
            assertFalse(String.valueOf(target), policy.owns(target));
        }
    }
    @Test public void refusesUnsafeOrAmbiguousServerSettings() {
        for (String input : new String[]{"http://panel.example", "https://u:p@panel.example", "https://panel.example/api", "https://panel.example/?token=secret", "https://panel.example/#a", "https://panel.example:0", "https://panel.example:99999", "https://panel.example\\@evil.test", "https://panel.example\n.evil.test", "//panel.example", "", null}) {
            assertThrows(String.valueOf(input), IllegalArgumentException.class, () -> new PanelPolicy(input));
        }
    }
    @Test public void customHttpsPortRemainsPartOfOrigin() {
        PanelPolicy policy = new PanelPolicy("https://panel.example:8443");
        assertTrue(policy.owns("https://panel.example:8443/usuarios"));
        assertFalse(policy.owns("https://panel.example/usuarios"));
    }
    @Test public void externalLinksCannotLaunchArbitraryIntentsOrCleartext() {
        assertTrue(PanelPolicy.canOpenExternally("https://wa.me/595981234567"));
        assertTrue(PanelPolicy.canOpenExternally("mailto:soporte@example.com"));
        assertTrue(PanelPolicy.canOpenExternally("tel:+595981234567"));
        for (String url : new String[]{"intent://evil/#Intent;end", "javascript:alert(1)", "http://example.com", "file:///sdcard/a", "content://settings", "data:text/html,test", "https://u:p@example.com", "https://example.com\n", null}) assertFalse(PanelPolicy.canOpenExternally(url));
    }
}
