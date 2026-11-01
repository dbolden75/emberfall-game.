package com.emberfall.ashvale;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * User-directed backup export/import through Android's Storage Access Framework.
 * No cloud credentials, storage permissions, or implicit save replacement.
 * The existing cloud-save-core.js validates backups and requires restore consent.
 */
final class CloudSaveDocuments {
    static final int CREATE_DOCUMENT_REQUEST = 7193;
    static final int OPEN_DOCUMENT_REQUEST = 7194;
    private static final int MAX_BYTES = 8 * 1024 * 1024;

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private Pending pending;
    // This flag stays set until the document worker has finished. The picker
    // may close before an export has been written or an import has been read.
    // Access it on the UI thread, just like pending.
    private boolean documentIoActive;
    private volatile boolean closed;

    private static final class Pending {
        final String id;
        final String action;
        final byte[] bytes;
        Pending(String id, String action, byte[] bytes) {
            this.id = id;
            this.action = action;
            this.bytes = bytes;
        }
    }

    CloudSaveDocuments(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface public void save(String requestId, String backupJson) {
        activity.runOnUiThread(() -> beginSave(requestId, backupJson));
    }

    @JavascriptInterface public void load(String requestId, String ignoredText) {
        activity.runOnUiThread(() -> beginLoad(requestId));
    }

    @JavascriptInterface public void manage(String requestId, String ignoredText) {
        activity.runOnUiThread(() ->
            result(requestId, "manage", false, false,
                "Open Google Drive or Files to rename, move, or delete backup files.", null));
    }

    private boolean validRequest(String id) {
        return id != null && id.matches("[a-z0-9_]{1,80}");
    }

    private void beginSave(String id, String json) {
        if (closed || !validRequest(id)) return;
        if (pending != null || documentIoActive) {
            result(id, "save", false, false, "Finish the current backup first.", null);
            return;
        }
        if (json == null) {
            result(id, "save", false, false, "There is no backup to export.", null);
            return;
        }
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) {
            result(id, "save", false, false, "Backup exceeds 8 MB.", null);
            return;
        }
        pending = new Pending(id, "save", bytes);
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            String date = new SimpleDateFormat("yyyy-MM-dd-HHmmss", Locale.US).format(new Date());
            intent.putExtra(Intent.EXTRA_TITLE, "Thornhaven-" + date + ".json");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            activity.startActivityForResult(intent, CREATE_DOCUMENT_REQUEST);
        } catch (Exception e) {
            pending = null;
            result(id, "save", false, false, "No document provider is available. Local saves are unchanged.", null);
        }
    }

    private void beginLoad(String id) {
        if (closed || !validRequest(id)) return;
        if (pending != null || documentIoActive) {
            result(id, "load", false, false, "Finish the current backup first.", null);
            return;
        }
        pending = new Pending(id, "load", null);
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES,
                new String[] {"application/json", "text/plain", "application/octet-stream"});
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivityForResult(intent, OPEN_DOCUMENT_REQUEST);
        } catch (Exception e) {
            pending = null;
            result(id, "load", false, false, "No document provider is available. Local saves are unchanged.", null);
        }
    }

    /** Called from MainActivity.onActivityResult on the UI thread. */
    boolean onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != CREATE_DOCUMENT_REQUEST && requestCode != OPEN_DOCUMENT_REQUEST) return false;
        Pending request = pending;
        pending = null;
        if (request == null || closed) return true;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            result(request.id, request.action, false, true, null, null);
            return true;
        }
        Uri uri = data.getData();
        // Do not permit a second picker while the first document's I/O is
        // incomplete; otherwise exports/imports can overlap and race results.
        documentIoActive = true;
        io.execute(() -> {
            try {
                if ("save".equals(request.action)) {
                    try (OutputStream output = activity.getContentResolver().openOutputStream(uri, "wt")) {
                        if (output == null) throw new IOException("Cannot open document for writing");
                        output.write(request.bytes);
                        output.flush();
                    }
                    // A provider can acknowledge a write while retaining incomplete data.
                    // Read the document back before telling the player it is backed up.
                    try (InputStream verification = activity.getContentResolver().openInputStream(uri)) {
                        BackupDocumentIntegrity.verify(verification, request.bytes);
                    }
                    result(request.id, "save", true, false, null, null);
                } else {
                    String text;
                    try (InputStream input = activity.getContentResolver().openInputStream(uri)) {
                        if (input == null) throw new IOException("Cannot open document for reading");
                        ByteArrayOutputStream output = new ByteArrayOutputStream();
                        byte[] buffer = new byte[8192];
                        int read;
                        int emptyReads = 0;
                        while ((read = input.read(buffer)) != -1) {
                            // A defective document provider returning zero on
                            // every read must fail, not hang future backups.
                            if (read == 0) {
                                if (++emptyReads >= 16) throw new IOException("Document provider repeatedly returned no bytes");
                                continue;
                            }
                            emptyReads = 0;
                            if (output.size() + read > MAX_BYTES)
                                throw new IOException("Backup exceeds 8 MB");
                            output.write(buffer, 0, read);
                        }
                        text = new String(output.toByteArray(), StandardCharsets.UTF_8);
                    }
                    result(request.id, "load", true, false, null, text);
                }
            } catch (Exception e) {
                result(request.id, request.action, false, false,
                    "save".equals(request.action)
                        ? "Backup export could not be verified. Local characters are unchanged; check the selected document before relying on it."
                        : "The document operation failed. Your local characters have not been replaced.", null);
            } finally {
                activity.runOnUiThread(() -> documentIoActive = false);
            }
        });
        return true;
    }

    private void result(String id, String action, boolean ok, boolean cancelled,
                        String message, String text) {
        if (closed) return;
        activity.runOnUiThread(() -> {
            if (closed) return;
            try {
                JSONObject data = new JSONObject()
                    .put("id", id).put("action", action)
                    .put("ok", ok).put("cancelled", cancelled);
                if (message != null) data.put("message", message);
                if (text != null) data.put("text", text);
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('thornhavenCloudResult',{detail:"
                    + data.toString() + "}));", null);
            } catch (Exception ignored) {
                // Never log backup contents or change local save keys on native failure.
            }
        });
    }

    void close() {
        closed = true;
        pending = null;
        io.shutdownNow();
    }
}
