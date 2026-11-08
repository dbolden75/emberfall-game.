package com.emberfall.ashvale;

public final class TrustedGameNavigationTest {
    private static int cases;
    private static void check(String url, boolean expected) {
        cases++;
        boolean actual = TrustedGameNavigation.isTrusted(url);
        if (actual != expected)
            throw new AssertionError("Trust decision failed for " + url + ": " + actual);
    }
    public static void main(String[] args) {
        check("file:///android_asset/index.html", true);
        check("file:///android_asset/index.html#options", true);
        check("https://example.org/", false);
        check("http://example.org/android_asset/index.html", false);
        check("file:///sdcard/Download/index.html", false);
        check("file://untrusted/android_asset/index.html", false);
        check("file:///android_asset/index.html/../evil.html", false);
        check("file:///android_asset/index.html%2Fevil.html", false);
        check("file:///android_asset/index.html?redirect=1", false);
        check("file:///android_asset/other.html", false);
        check("content://media/anything", false);
        check("data:text/html,hello", false);
        check("javascript:alert(1)", false);
        check("about:blank", false);
        check("file:///android_asset/index.html%23spoof", false);
        check("FILE:///android_asset/index.html", false);
        check("file:///android_asset/index.html#fragment?query", true);
        check("file:///android_asset/index.html#%ZZ", false);
        check(null, false);
        System.out.println("PASS: " + cases + " local-only WebView navigation decisions");
    }
}
