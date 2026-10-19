package com.saathi.emergency;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

public class SaathiVolumeTriggerService extends AccessibilityService {
    private boolean isVolumeUpPressed = false;
    private boolean isVolumeDownPressed = false;
    private long lastVolumeUpTime = 0;
    private long lastVolumeDownTime = 0;
    private long lastChordTriggerTime = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // No UI tree inspection needed; service strictly filters physical volume keys
    }

    @Override
    public void onInterrupt() {}

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        int action = event.getAction();
        int keyCode = event.getKeyCode();

        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            long now = System.currentTimeMillis();

            if (action == KeyEvent.ACTION_DOWN) {
                // Ignore repeat events from long press
                if (event.getRepeatCount() > 0) {
                    return false;
                }

                if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                    isVolumeUpPressed = true;
                    lastVolumeUpTime = now;
                } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                    isVolumeDownPressed = true;
                    lastVolumeDownTime = now;
                }

                // Check if both Volume Up and Volume Down are engaged together:
                // 1. Both currently held down, OR
                // 2. Both pressed within 500ms of each other
                boolean bothEngaged = (isVolumeUpPressed && isVolumeDownPressed) ||
                                      (Math.abs(lastVolumeUpTime - lastVolumeDownTime) <= 500);

                if (bothEngaged) {
                    if (now - lastChordTriggerTime > 400) {
                        lastChordTriggerTime = now;
                        launchAppAndTriggerMic();
                    }
                    return true; // Consume volume event so system volume slider does not flash
                }
            } else if (action == KeyEvent.ACTION_UP) {
                if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                    isVolumeUpPressed = false;
                } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                    isVolumeDownPressed = false;
                }
            }
        }

        return super.onKeyEvent(event);
    }

    private void launchAppAndTriggerMic() {
        // 1. Tactile vibration confirmation
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vibratorManager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vibratorManager != null) {
                    vibratorManager.getDefaultVibrator().vibrate(
                        VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE)
                    );
                }
            } else {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(100);
                    }
                }
            }
        } catch (Exception ignored) {}

        // 2. Launch Saathi MainActivity directly to the front and signal mic trigger
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            intent.putExtra("START_MIC_TRIGGER", true);
            startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
