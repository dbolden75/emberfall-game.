package com.emberfall.ashvale;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.webkit.JavascriptInterface;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;
import android.os.Build;
import android.view.WindowInsets;

public class MainActivity extends Activity {
    private WebView game;
    private PlayBillingPreparation billing;
    private PlaytestConnection playtest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyOrientation(getPreferences(MODE_PRIVATE).getString("orientation", "landscape"));
        getWindow().setStatusBarColor(Color.rgb(16, 22, 19));
        getWindow().setNavigationBarColor(Color.rgb(16, 22, 19));
        applyImmersiveMode();

        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(16, 22, 19));
        game.setOverScrollMode(View.OVER_SCROLL_NEVER);
        game.setHapticFeedbackEnabled(false);
        game.setLongClickable(false);
        game.setOnLongClickListener(view -> true);
        game.setWebViewClient(new WebViewClient());
        game.setWebChromeClient(new WebChromeClient());

        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        game.addJavascriptInterface(new DevicePreferences(), "ThornhavenDevice");
        playtest = new PlaytestConnection(this, game);
        game.addJavascriptInterface(playtest, "ThornhavenPlaytest");
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true);
        WebView.setWebContentsDebuggingEnabled(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Keep controls clear of display cutouts and system bars on edge-to-edge Android.
        game.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        billing = new PlayBillingPreparation(this);
        game.addJavascriptInterface(billing, "ThornhavenPlayPurchases");
        billing.connect();
        setContentView(game);
        game.requestApplyInsets();
        game.loadUrl("file:///android_asset/index.html");
    }

    private void applyOrientation(String mode) {
        setRequestedOrientation("portrait".equals(mode) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                : "auto".equals(mode) ? ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                : ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
    }

    public class DevicePreferences {
        @JavascriptInterface public void openPrivacyPolicy() {
            runOnUiThread(() -> {
                try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://thornhaven-community.blushbeech32.chatgpt.site/privacy"))); }
                catch (android.content.ActivityNotFoundException ignored) { android.widget.Toast.makeText(MainActivity.this,"Open the privacy policy on the Thornhaven website.",android.widget.Toast.LENGTH_LONG).show(); }
            });
        }
        @JavascriptInterface public void openChatGPTBesideGame() {
            runOnUiThread(() -> {
                android.content.Intent launch=getPackageManager().getLaunchIntentForPackage("com.openai.chatgpt");
                if(launch==null){android.widget.Toast.makeText(MainActivity.this,"ChatGPT is not installed.",android.widget.Toast.LENGTH_LONG).show();return;}
                launch.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                if(Build.VERSION.SDK_INT>=24)launch.addFlags(android.content.Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT);
                try {startActivity(launch);}
                catch(android.content.ActivityNotFoundException e){android.widget.Toast.makeText(MainActivity.this,"Open ChatGPT using your phone's split-screen menu.",android.widget.Toast.LENGTH_LONG).show();}
            });
        }
        @JavascriptInterface public void openForumShop() {
            runOnUiThread(() -> {
                try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://thornhaven-community.blushbeech32.chatgpt.site/shop"))); }
                catch (android.content.ActivityNotFoundException ignored) { android.widget.Toast.makeText(MainActivity.this, "No browser is available to open the forum.", android.widget.Toast.LENGTH_SHORT).show(); }
            });
        }
        @JavascriptInterface public String getOrientationPreference() {
            return getPreferences(MODE_PRIVATE).getString("orientation", "landscape");
        }
        @JavascriptInterface public void setOrientationPreference(String mode) {
            if (!"landscape".equals(mode) && !"portrait".equals(mode) && !"auto".equals(mode)) return;
            getPreferences(MODE_PRIVATE).edit().putString("orientation", mode).apply();
            runOnUiThread(() -> applyOrientation(mode));
        }
    }

    private void applyImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersiveMode();
    }

    @Override
    public void onBackPressed() {
        if (game != null && game.canGoBack()) game.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (game != null) game.evaluateJavascript("window.dispatchEvent(new Event('pagehide'))", null);
        if (game != null) { game.onPause(); game.pauseTimers(); }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (game != null) { game.onResume(); game.resumeTimers(); }
        if (billing != null) billing.connect();
    }

    @Override
    protected void onDestroy() {
        if (playtest != null) playtest.close();
        if (billing != null) billing.close();
        if (game != null) { game.destroy(); game = null; }
        super.onDestroy();
    }
}
