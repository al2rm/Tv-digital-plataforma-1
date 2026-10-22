package com.tvdigital.admin;

import java.net.URI;
import java.util.Locale;

/** One explicit HTTPS origin owns the administrative session and native export capability. */
public final class PanelPolicy {
    public final String origin;
    public final String home;

    public PanelPolicy(String input) {
        URI url = parse(input == null ? "" : input.trim());
        if (!"https".equalsIgnoreCase(url.getScheme()) || url.getHost() == null
                || url.getRawUserInfo() != null || url.getRawQuery() != null
                || url.getRawFragment() != null || url.getPort() == 0 || url.getPort() > 65535
                || !(url.getRawPath().isEmpty() || "/".equals(url.getRawPath()))) {
            throw new IllegalArgumentException("Usa la dirección HTTPS principal del panel, sin /api ni datos de acceso.");
        }
        origin = originOf(url);
        home = origin + "/";
    }

    public boolean owns(String input) {
        try {
            URI url = parse(input);
            return "https".equalsIgnoreCase(url.getScheme()) && url.getRawUserInfo() == null
                    && url.getHost() != null && origin.equals(originOf(url));
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    public static boolean canOpenExternally(String input) {
        try {
            URI url = parse(input);
            String scheme = url.getScheme();
            if (scheme == null) return false;
            if ("https".equalsIgnoreCase(scheme)) {
                return url.getHost() != null && url.getRawUserInfo() == null;
            }
            return ("mailto".equalsIgnoreCase(scheme) || "tel".equalsIgnoreCase(scheme))
                    && !url.getRawSchemeSpecificPart().isEmpty();
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private static URI parse(String input) {
        if (input == null || input.contains("\\") || input.chars().anyMatch(c -> c <= 32 || c == 127)) {
            throw new IllegalArgumentException("Dirección no válida.");
        }
        return URI.create(input);
    }

    private static String originOf(URI uri) {
        int port = uri.getPort();
        return "https://" + uri.getHost().toLowerCase(Locale.ROOT)
                + (port == -1 || port == 443 ? "" : ":" + port);
    }
}
