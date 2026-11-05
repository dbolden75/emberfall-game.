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
    private CloudSaveDocuments cloudSave;

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
        // Android Storage Access Framework: a user-selected Drive/Files document,
        // never automatic cloud upload or a change to historical save storage.
        cloudSave = new CloudSaveDocuments(this, game);
        game.addJavascriptInterface(cloudSave, "ThornhavenCloudSave");
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

    // Android Back must not destroy a character after a failed/silent localStorage
    // write. The existing pagehide handler only reports JS completion; it swallows
    // quota/storage errors inside saveGame(). Verify the authoritative slot bytes.
    // Title-menu exits need no character write. Keep the WebView open on errors.
    private boolean backExitPending;
    private void backSaveFailed(WebView view) {
        if (game != view || isFinishing()) return;
        backExitPending = false; // A later Back can retry after storage is freed.
        android.widget.Toast.makeText(this,
            "Character save could not be confirmed. Thornhaven stayed open; free storage and retry.",
            android.widget.Toast.LENGTH_LONG).show();
    }

    @Override
    public void onBackPressed() {
        if (game != null && game.canGoBack()) { game.goBack(); return; }
        if (backExitPending) return;
        backExitPending = true;
        final WebView closingView = game;
        if (closingView == null) { finish(); return; }
        final boolean[] handled = {false};
        final Runnable failSafe = () -> backSaveFailed(closingView);
        try {
            closingView.evaluateJavascript(
                "(function(){try{if(!hasStarted||titleMenuActive)return true;" +
                "if(switchingCharacter)return false;" +
                "var expected=snapshotGameState();saveGame();" +
                "var slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');" +
                "var row=slots&&slots[activeSlotId];" +
                "return !!row&&JSON.stringify(row.state)===JSON.stringify(expected);" +
                "}catch(_){return false;}})()",
                result -> {
                    if (handled[0]) return;
                    handled[0] = true;
                    if (game != closingView) return;
                    if ("true".equals(result)) finish();
                    else failSafe.run();
                });
        } catch (RuntimeException saveUnavailable) {
            if (!handled[0]) { handled[0] = true; failSafe.run(); }
        }
        // If WebView never answers, do NOT assume the character was saved.
        // Avoid trapping Back forever: reset pending and show a retry notice.
        closingView.postDelayed(() -> {
            if (!handled[0]) { handled[0] = true; failSafe.run(); }
        }, 1500);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        if (cloudSave != null && cloudSave.onActivityResult(requestCode, resultCode, data)) return;
        super.onActivityResult(requestCode, resultCode, data);
    }

    // Confirm the real character-slot bytes after pagehide, not merely JS
    // event dispatch. saveGame() may swallow localStorage quota exceptions.
    // Android cannot force the app to remain foreground on Home, so report
    // an unverified background save when the player returns. Never clear data.
    private int pauseEpoch;
    private boolean lifecyclePaused;
    private boolean backgroundSaveUnverified;
    private void backgroundSaveFailed(WebView view, int epoch) {
        if (game != view || pauseEpoch != epoch) return;
        backgroundSaveUnverified = true;
    }

    @Override
    protected void onPause() {
        lifecyclePaused = true;
        final WebView pausedView = game;
        final int epoch = ++pauseEpoch;
        if (pausedView != null) {
            final Runnable finishPause = new Runnable() {
                private boolean completed;
                @Override public void run() {
                    if (completed || !lifecyclePaused || pauseEpoch != epoch || game != pausedView) return;
                    completed = true;
                    pausedView.onPause();
                    pausedView.pauseTimers();
                }
            };
            final boolean[] answered = {false};
            try {
                pausedView.evaluateJavascript(
                    "(function(){try{window.dispatchEvent(new Event('pagehide'));" +
                    "if(!hasStarted||titleMenuActive||switchingCharacter)return true;" +
                    "var expected=snapshotGameState();" +
                    "var slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');" +
                    "var row=slots&&slots[activeSlotId];" +
                    "return !!row&&JSON.stringify(row.state)===JSON.stringify(expected);" +
                    "}catch(_){return false;}})()",
                    result -> {
                        if (!answered[0]) {
                            answered[0] = true;
                            if (!"true".equals(result)) backgroundSaveFailed(pausedView, epoch);
                        }
                        finishPause.run();
                    });
            } catch (RuntimeException evaluateFailed) {
                answered[0] = true;
                backgroundSaveFailed(pausedView, epoch);
                finishPause.run();
            }
            // If WebView never returns, pause it but do not claim a save.
            // A late callback cannot override a failure or stop resumed play.
            pausedView.postDelayed(() -> {
                if (!answered[0]) {
                    answered[0] = true;
                    backgroundSaveFailed(pausedView, epoch);
                }
                finishPause.run();
            }, 1000);
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        lifecyclePaused = false;
        ++pauseEpoch;
        if (game != null) { game.onResume(); game.resumeTimers(); }
        if (backgroundSaveUnverified) {
            backgroundSaveUnverified = false;
            android.widget.Toast.makeText(this,
                "Previous character save could not be confirmed. Check your character and free storage before leaving.",
                android.widget.Toast.LENGTH_LONG).show();
        }
        if (billing != null) billing.connect();
    }

    @Override
    protected void onDestroy() {
        lifecyclePaused = false;
        ++pauseEpoch;
        if (playtest != null) playtest.close();
        if (cloudSave != null) cloudSave.close();
        if (billing != null) billing.close();
        if (game != null) { game.destroy(); game = null; }
        super.onDestroy();
    }
}
