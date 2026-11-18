package com.emberfall.ashvale;

import android.app.Activity;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.JavascriptInterface;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

/** Trusted local game only. Never downloads voices, queues dialogue or records speech. */
public final class NpcSpeech {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicLong epoch = new AtomicLong();
    private final List<Voice> voices = new ArrayList<>();
    private final AudioManager audio;
    private final AudioManager.OnAudioFocusChangeListener focus;
    private TextToSpeech engine;
    private volatile String state = "loading";
    private volatile boolean foreground = true, closed;

    public NpcSpeech(Activity activity) {
        audio = (AudioManager) activity.getSystemService(Activity.AUDIO_SERVICE);
        focus = change -> { if (change < 0) stop(); };
        try {
            engine = new TextToSpeech(activity, result -> main.post(() -> initialize(result)));
        } catch (RuntimeException unavailable) { state = "unavailable"; }
    }

    private void initialize(int result) {
        if (closed || engine == null) return;
        if (result != TextToSpeech.SUCCESS) { state = "unavailable"; return; }
        try {
            Set<Voice> candidates = engine.getVoices();
            if (candidates != null) for (Voice v : candidates) {
                if (v != null && v.getLocale() != null && "en".equals(v.getLocale().getLanguage())
                        && !v.isNetworkConnectionRequired()
                        && (v.getFeatures() == null || !v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))) voices.add(v);
            }
            voices.sort(Comparator.comparingInt(Voice::getQuality).reversed().thenComparing(Voice::getName));
            engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { finish(id, false); }
                @Override public void onError(String id) { finish(id, true); }
            });
            state = voices.isEmpty() ? "no-offline-english" : "ready";
        } catch (RuntimeException unavailable) { state = "unavailable"; }
    }

    private void finish(String id, boolean error) {
        main.post(() -> {
            if (closed || !Long.toString(epoch.get()).equals(id)) return;
            try { if (audio != null) audio.abandonAudioFocus(focus); } catch (RuntimeException ignored) { }
            if (error) state = "unavailable";
        });
    }

    @JavascriptInterface public String status() { return state; }

    /** Latest request wins. speakerId is a stable game identity, never a person's voice clone. */
    @JavascriptInterface public void speak(String speakerId, String profile, String text, double volume) {
        final long token = epoch.incrementAndGet();
        main.post(() -> {
            if (closed || epoch.get() != token) return;
            stopEngine();
            if (!foreground || !"ready".equals(state) || engine == null || voices.isEmpty()) return;
            if (speakerId == null || speakerId.isEmpty() || speakerId.length() > 120 || text == null
                    || text.trim().isEmpty() || text.length() > 3500 || !Double.isFinite(volume) || volume <= 0) return;
            int index = "carpenter".equals(profile) ? 1 : "courier".equals(profile) ? 2 : 0;
            float pitch = "carpenter".equals(profile) ? .94f : "courier".equals(profile) ? 1.04f : 1f;
            float rate = "carpenter".equals(profile) ? .94f : "courier".equals(profile) ? 1.02f : .98f;
            try {
                if (engine.setVoice(voices.get(index % voices.size())) != TextToSpeech.SUCCESS) { state = "unavailable"; return; }
                engine.setPitch(pitch); engine.setSpeechRate(rate);
                if (audio != null && audio.requestAudioFocus(focus, AudioManager.STREAM_MUSIC,
                        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) return;
                Bundle params = new Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, (float)Math.min(1, volume));
                if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, Long.toString(token)) != TextToSpeech.SUCCESS) {
                    stopEngine(); state = "unavailable";
                }
            } catch (RuntimeException unavailable) { stopEngine(); state = "unavailable"; }
        });
    }

    @JavascriptInterface public void stop() {
        final long token = epoch.incrementAndGet();
        main.post(() -> { if (epoch.get() == token) stopEngine(); });
    }
    private void stopEngine() {
        try { if (engine != null) engine.stop(); } catch (RuntimeException ignored) { }
        try { if (audio != null) audio.abandonAudioFocus(focus); } catch (RuntimeException ignored) { }
    }
    public void setForeground(boolean value) { foreground = value; if (!value) stop(); }
    public void close() {
        closed = true; foreground = false; state = "unavailable"; epoch.incrementAndGet();
        stopEngine();
        try { if (engine != null) engine.shutdown(); } catch (RuntimeException ignored) { }
        engine = null; voices.clear();
    }
}
