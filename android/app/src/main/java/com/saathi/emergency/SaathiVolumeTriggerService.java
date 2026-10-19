package com.saathi.emergency;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;
import androidx.core.app.NotificationCompat;

public class SaathiVolumeTriggerService extends AccessibilityService {
    private static final String CHANNEL_ID = "saathi_emergency_channel";
    private static final int NOTIF_ID = 1187;

    private boolean isVolumeUpPressed = false;
    private boolean isVolumeDownPressed = false;
    private long lastVolumeUpTime = 0;
    private long lastVolumeDownTime = 0;
    private long lastChordTriggerTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // No UI tree inspection needed; strictly filters hardware keys
    }

    @Override
    public void onInterrupt() {}

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        int action = event.getAction();

        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            long now = System.currentTimeMillis();

            if (action == KeyEvent.ACTION_DOWN) {
                if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                    isVolumeUpPressed = true;
                    lastVolumeUpTime = now;
                } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                    isVolumeDownPressed = true;
                    lastVolumeDownTime = now;
                }
            } else if (action == KeyEvent.ACTION_UP) {
                if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                    isVolumeUpPressed = false;
                    lastVolumeUpTime = now;
                } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                    isVolumeDownPressed = false;
                    lastVolumeDownTime = now;
                }
            }

            // Both buttons engaged together:
            // 1. Both currently pressed down simultaneously, OR
            // 2. Both pressed/clicked within 1200ms of each other (handles rocker fulcrum pivot & finger offset)
            boolean bothEngaged = (isVolumeUpPressed && isVolumeDownPressed) ||
                (lastVolumeUpTime > 0 && lastVolumeDownTime > 0 && Math.abs(lastVolumeUpTime - lastVolumeDownTime) <= 1200);

            if (bothEngaged) {
                // Prevent duplicate trigger bursts within 1500ms
                if (now - lastChordTriggerTime > 1500) {
                    lastChordTriggerTime = now;
                    launchAppAndTriggerMic();
                }
                return true; // Consume volume event so system volume HUD does not appear
            }
        }

        return super.onKeyEvent(event);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Saathi Emergency Alert",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Emergency Wake & Full-screen Trigger");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void launchAppAndTriggerMic() {
        // 1. Provide an immediate 100ms tactile buzz confirmation
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

        // 2. Acquire WakeLock to turn on the screen if sleeping or locked
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "saathi:panic_wake_lock"
                );
                wakeLock.acquire(4000);
            }
        } catch (Exception ignored) {}

        // 3. Prepare Launch Intent
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        intent.putExtra("START_MIC_TRIGGER", true);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(this, NOTIF_ID, intent, flags);

        // 4. Fire High-Priority FullScreenIntent Notification (bypasses Android 10+ lockscreen BAL restriction)
        try {
            NotificationCompat.Builder notifBuilder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🚨 Saathi Emergency Mic Active")
                .setContentText("Emergency distress microphone is listening...")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setAutoCancel(true);

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIF_ID, notifBuilder.build());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 5. Direct launch fallbacks
        try {
            startActivity(intent);
        } catch (Exception ignored) {}
        try {
            fullScreenPendingIntent.send();
        } catch (Exception ignored) {}
    }
}
