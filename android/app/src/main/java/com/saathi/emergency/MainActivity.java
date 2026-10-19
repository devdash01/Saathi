package com.saathi.emergency;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.KeyEvent;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean isVolumeUpPressed = false;
    private boolean isVolumeDownPressed = false;
    private long lastVolumeUpTime = 0;
    private long lastVolumeDownTime = 0;
    private long lastChordTriggerTime = 0;

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int action = event.getAction();
        int keyCode = event.getKeyCode();

        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            long now = System.currentTimeMillis();

            if (action == KeyEvent.ACTION_DOWN) {
                // Ignore key repeat events from long press to avoid spam
                if (event.getRepeatCount() > 0) {
                    return true;
                }

                if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                    isVolumeUpPressed = true;
                    lastVolumeUpTime = now;
                } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                    isVolumeDownPressed = true;
                    lastVolumeDownTime = now;
                }

                // Check if both Volume Up and Volume Down are triggered together:
                // 1. Both physical buttons currently held down simultaneously, OR
                // 2. Both pressed within 500ms of each other (natural finger interval on rocker)
                boolean bothEngaged = (isVolumeUpPressed && isVolumeDownPressed) ||
                                      (Math.abs(lastVolumeUpTime - lastVolumeDownTime) <= 500);

                if (bothEngaged) {
                    // Debounce triggers within 350ms
                    if (now - lastChordTriggerTime > 350) {
                        lastChordTriggerTime = now;
                        triggerMicActivation();
                    }
                    return true; // Consume event to prevent Android volume slider popup
                }
            } else if (action == KeyEvent.ACTION_UP) {
                if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                    isVolumeUpPressed = false;
                } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                    isVolumeDownPressed = false;
                }
            }
        }

        return super.dispatchKeyEvent(event);
    }

    private void triggerMicActivation() {
        // Quick 70ms tactile vibration feedback to notify user the emergency mic opened
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vibratorManager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vibratorManager != null) {
                    vibratorManager.getDefaultVibrator().vibrate(
                        VibrationEffect.createOneShot(70, VibrationEffect.DEFAULT_AMPLITUDE)
                    );
                }
            } else {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(70, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(70);
                    }
                }
            }
        } catch (Exception ignored) {}

        // Dispatch hardware-mic-trigger event to Capacitor WebView
        runOnUiThread(() -> {
            try {
                if (bridge != null && bridge.getWebView() != null) {
                    WebView webView = bridge.getWebView();
                    String js = "window.dispatchEvent(new CustomEvent('saathi:hardware-mic-trigger', { detail: { timestamp: " + System.currentTimeMillis() + " } }));";
                    webView.evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}
