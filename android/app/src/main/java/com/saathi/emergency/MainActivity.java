package com.saathi.emergency;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean isVolumeUpPressed = false;
    private boolean isVolumeDownPressed = false;
    private long lastVolumeUpTime = 0;
    private long lastVolumeDownTime = 0;
    private long lastChordTriggerTime = 0;
    private boolean isPendingMicTrigger = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Allow app to display over lockscreen and turn on screen in emergency
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        // Attach native bridge to WebView once bridge is ready
        mainHandler.postDelayed(this::setupNativeBridge, 800);

        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("START_MIC_TRIGGER", false)) {
            isPendingMicTrigger = true;
            // Schedule mic trigger attempts to guarantee delivery when WebView finishes rendering
            deliverPendingMicTrigger();
            mainHandler.postDelayed(this::deliverPendingMicTrigger, 600);
            mainHandler.postDelayed(this::deliverPendingMicTrigger, 1500);
        }
    }

    private void deliverPendingMicTrigger() {
        if (!isPendingMicTrigger) return;
        triggerMicActivation();
    }

    private void setupNativeBridge() {
        try {
            if (bridge != null && bridge.getWebView() != null) {
                WebView webView = bridge.getWebView();
                webView.addJavascriptInterface(new NativeSaathiBridge(), "SaathiNative");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public class NativeSaathiBridge {
        @JavascriptInterface
        public void openAccessibilitySettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public boolean isAccessibilityEnabled() {
            return isAccessibilityServiceEnabled(MainActivity.this, SaathiVolumeTriggerService.class);
        }
    }

    public static boolean isAccessibilityServiceEnabled(Context context, Class<?> service) {
        try {
            String expectedComponentName = new ComponentName(context, service).flattenToString();
            String enabledServicesSetting = Settings.Secure.getString(
                context.getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            if (enabledServicesSetting == null) return false;
            TextUtils.SimpleStringSplitter colonSplitter = new TextUtils.SimpleStringSplitter(':');
            colonSplitter.setString(enabledServicesSetting);
            while (colonSplitter.hasNext()) {
                String componentNameString = colonSplitter.next();
                if (componentNameString.equalsIgnoreCase(expectedComponentName)) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int action = event.getAction();
        int keyCode = event.getKeyCode();

        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            long now = System.currentTimeMillis();

            if (action == KeyEvent.ACTION_DOWN) {
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

                boolean bothEngaged = (isVolumeUpPressed && isVolumeDownPressed) ||
                                      (Math.abs(lastVolumeUpTime - lastVolumeDownTime) <= 500);

                if (bothEngaged) {
                    if (now - lastChordTriggerTime > 350) {
                        lastChordTriggerTime = now;
                        triggerMicActivation();
                    }
                    return true;
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
        // Crisp tactile feedback
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
