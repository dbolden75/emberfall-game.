package com.emberfall.ashvale;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * Thornhaven grants its bundled game page access to JavaScript interfaces for
 * local save documents, purchases, device settings, and playtesting. Never
 * navigate that privileged WebView to untrusted local or remote content.
 */
final class TrustedGameNavigation {
    private static final String TRUSTED_PATH = "/android_asset/index.html";

    private TrustedGameNavigation() {}

    static boolean isTrusted(String url) {
        if (url == null) return false;
        try {
            URI uri = new URI(url);
            return "file".equals(uri.getScheme())
                    && uri.getRawAuthority() == null
                    && TRUSTED_PATH.equals(uri.getRawPath())
                    && uri.getRawQuery() == null;
            // Fragment anchors on the same packaged page are harmless.
        } catch (URISyntaxException | IllegalArgumentException malformed) {
            return false;
        }
    }
}
