package com.saathi.emergency;

import android.app.KeyguardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.telephony.SmsManager;
import android.text.TextUtils;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.PermissionRequest;
import com.getcapacitor.BridgeWebChromeClient;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private boolean isVolumeUpPressed = false;
    private boolean isVolumeDownPressed = false;
    private long lastVolumeUpTime = 0;
    private long lastVolumeDownTime = 0;
    private long lastChordTriggerTime = 0;
    private boolean isPendingMicTrigger = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private SpeechRecognizer speechRecognizer = null;
    private boolean isNativeSpeechListening = false;
    private String activeSpeechLanguage = "hi-IN";
    private String accumulatedSentences = "";
    private TextToSpeech nativeTTS = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        unlockAndTurnScreenOn();
        super.onCreate(savedInstanceState);

        // Attach native bridge to WebView immediately and on short delayed ticks
        setupNativeBridge();
        mainHandler.postDelayed(this::setupNativeBridge, 250);
        mainHandler.postDelayed(this::setupNativeBridge, 800);

        try {
            nativeTTS = new TextToSpeech(this, status -> {
                if (status == TextToSpeech.SUCCESS && nativeTTS != null) {
                    nativeTTS.setLanguage(new Locale("hi", "IN"));
                }
            });
        } catch (Exception ignored) {}

        // Proactively request SMS, Audio recording, and Location permissions
        checkAndRequestPermissions();

        handleIntent(getIntent());
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        unlockAndTurnScreenOn();
    }

    @Override
    public void onResume() {
        super.onResume();
        unlockAndTurnScreenOn();
    }

    private void unlockAndTurnScreenOn() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
                KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                if (km != null) {
                    km.requestDismissKeyguard(this, null);
                }
            }
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        } catch (Exception ignored) {}
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        unlockAndTurnScreenOn();
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("START_MIC_TRIGGER", false)) {
            isPendingMicTrigger = true;
            deliverPendingMicTrigger();
            mainHandler.postDelayed(this::deliverPendingMicTrigger, 500);
            mainHandler.postDelayed(this::deliverPendingMicTrigger, 1200);
        }
    }

    private void deliverPendingMicTrigger() {
        if (!isPendingMicTrigger) return;
        triggerMicActivation();
    }

    private void checkAndRequestPermissions() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                ArrayList<String> missing = new ArrayList<>();
                if (checkSelfPermission(android.Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
                    missing.add(android.Manifest.permission.SEND_SMS);
                }
                if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    missing.add(android.Manifest.permission.RECORD_AUDIO);
                }
                if (!missing.isEmpty()) {
                    requestPermissions(missing.toArray(new String[0]), 101);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void checkAndRequestSmsPermission() {
        checkAndRequestPermissions();
    }

    private void startNativeSpeechRecognizer(String lang) {
        startNativeSpeechRecognizer(lang, null);
    }

    private void startNativeSpeechRecognizer(String lang, String initialText) {
        runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, 102);
                        sendSpeechErrorToWeb("Microphone permission required");
                        return;
                    }
                }

                activeSpeechLanguage = (lang != null && (lang.equals("English") || lang.equals("en-IN"))) ? "en-IN" : "hi-IN";

                if (initialText != null && !initialText.trim().isEmpty()) {
                    accumulatedSentences = initialText.trim();
                }

                if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                    sendSpeechErrorToWeb("Speech recognition not available on this device");
                    return;
                }

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, activeSpeechLanguage);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, activeSpeechLanguage);
                intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
                    speechRecognizer.setRecognitionListener(new RecognitionListener() {
                        @Override
                        public void onReadyForSpeech(Bundle params) {}

                        @Override
                        public void onBeginningOfSpeech() {}

                        @Override
                        public void onRmsChanged(float rmsdB) {}

                        @Override
                        public void onBufferReceived(byte[] buffer) {}

                        @Override
                        public void onEndOfSpeech() {}

                        @Override
                        public void onError(int error) {
                            if (!isNativeSpeechListening) return;

                            // Auto-restart on speech pause or silence timeout
                            mainHandler.postDelayed(() -> {
                                if (isNativeSpeechListening && speechRecognizer != null) {
                                    try {
                                        speechRecognizer.cancel();
                                        speechRecognizer.startListening(intent);
                                    } catch (Exception ignored) {
                                        startNativeSpeechRecognizer(activeSpeechLanguage, null);
                                    }
                                }
                            }, 80);
                        }

                        @Override
                        public void onResults(Bundle results) {
                            ArrayList<String> matches = results != null ? results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
                            if (matches != null && !matches.isEmpty()) {
                                String finalSentence = matches.get(0).trim();
                                if (!finalSentence.isEmpty()) {
                                    accumulatedSentences = accumulatedSentences.isEmpty() ? finalSentence : (accumulatedSentences + ". " + finalSentence);
                                    sendSpeechResultToWeb(accumulatedSentences, true);
                                }
                            }
                            if (isNativeSpeechListening && speechRecognizer != null) {
                                mainHandler.postDelayed(() -> {
                                    if (isNativeSpeechListening && speechRecognizer != null) {
                                        try {
                                            speechRecognizer.startListening(intent);
                                        } catch (Exception ignored) {
                                            startNativeSpeechRecognizer(activeSpeechLanguage, null);
                                        }
                                    }
                                }, 60);
                            }
                        }

                        @Override
                        public void onPartialResults(Bundle partialResults) {
                            ArrayList<String> matches = partialResults != null ? partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
                            if (matches != null && !matches.isEmpty()) {
                                String partial = matches.get(0).trim();
                                if (!partial.isEmpty()) {
                                    String live = accumulatedSentences.isEmpty() ? partial : (accumulatedSentences + ". " + partial);
                                    sendSpeechResultToWeb(live, false);
                                }
                            }
                        }

                        @Override
                        public void onEvent(int eventType, Bundle params) {}
                    });
                }

                isNativeSpeechListening = true;
                speechRecognizer.cancel();
                speechRecognizer.startListening(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void stopNativeSpeechRecognizer() {
        runOnUiThread(() -> {
            isNativeSpeechListening = false;
            if (speechRecognizer != null) {
                try {
                    speechRecognizer.stopListening();
                    speechRecognizer.destroy();
                } catch (Exception ignored) {}
                speechRecognizer = null;
            }
        });
    }

    private void sendSpeechResultToWeb(String transcript, boolean isFinal) {
        runOnUiThread(() -> {
            try {
                if (bridge != null && bridge.getWebView() != null) {
                    String escaped = transcript.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
                    String js = "window.dispatchEvent(new CustomEvent('saathi:native-speech-result', { detail: { transcript: '" + escaped + "', isFinal: " + isFinal + " } }));";
                    bridge.getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void sendSpeechErrorToWeb(String error) {
        runOnUiThread(() -> {
            try {
                if (bridge != null && bridge.getWebView() != null) {
                    String escaped = (error != null ? error : "Unknown error").replace("'", "\\'");
                    String js = "window.dispatchEvent(new CustomEvent('saathi:native-speech-error', { detail: { error: '" + escaped + "' } }));";
                    bridge.getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void setupNativeBridge() {
        try {
            if (bridge != null && bridge.getWebView() != null) {
                WebView webView = bridge.getWebView();
                webView.addJavascriptInterface(new NativeSaathiBridge(), "SaathiNative");

                // Seamlessly grant Web Speech API / WebRTC audio capture permissions to WebView
                webView.setWebChromeClient(new BridgeWebChromeClient(bridge) {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        runOnUiThread(() -> {
                            try {
                                request.grant(request.getResources());
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        });
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public class NativeSaathiBridge {
        @JavascriptInterface
        public boolean isNativeSpeechAvailable() {
            return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
        }

        @JavascriptInterface
        public void startSpeechRecognition(String lang) {
            startNativeSpeechRecognizer(lang, null);
        }

        @JavascriptInterface
        public void startSpeechRecognition(String lang, String initialText) {
            startNativeSpeechRecognizer(lang, initialText);
        }

        @JavascriptInterface
        public void resetSpeechAccumulator() {
            accumulatedSentences = "";
        }

        @JavascriptInterface
        public void stopSpeechRecognition() {
            stopNativeSpeechRecognizer();
        }

        @JavascriptInterface
        public void speak(String text) {
            if (nativeTTS != null && text != null) {
                runOnUiThread(() -> {
                    try {
                        nativeTTS.speak(text, TextToSpeech.QUEUE_FLUSH, null, "SaathiTTS");
                    } catch (Exception ignored) {}
                });
            }
        }

        @JavascriptInterface
        public boolean hasAudioPermission() {
            return checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestAudioPermission() {
            runOnUiThread(MainActivity.this::checkAndRequestPermissions);
        }

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

        @JavascriptInterface
        public boolean hasSmsPermission() {
            return checkSelfPermission(android.Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestSmsPermission() {
            runOnUiThread(MainActivity.this::checkAndRequestPermissions);
        }

        @JavascriptInterface
        public void dispatchSosNative(String phone, String message) {
            sendDirectSms(phone, message);
            openWhatsAppDirect(phone, message);
        }

        @JavascriptInterface
        public void sendDirectSms(String phone, String message) {
            try {
                String cleanPhone = phone.replaceAll("[^0-9+]", "");
                if (checkSelfPermission(android.Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
                    SmsManager smsManager = SmsManager.getDefault();
                    ArrayList<String> parts = smsManager.divideMessage(message);
                    smsManager.sendMultipartTextMessage(cleanPhone, null, parts, null, null);
                    return;
                } else {
                    // Prompt for permission if missing
                    runOnUiThread(MainActivity.this::checkAndRequestSmsPermission);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }

            try {
                String cleanPhone = phone.replaceAll("[^0-9+]", "");
                Intent intent = new Intent(Intent.ACTION_SENDTO);
                intent.setData(Uri.parse("smsto:" + Uri.encode(cleanPhone)));
                intent.putExtra("sms_body", message);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void openWhatsAppDirect(String phone, String message) {
            try {
                String cleanDigits = phone.replaceAll("[^0-9]", "");
                if (cleanDigits.length() == 10) cleanDigits = "91" + cleanDigits;
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse("https://api.whatsapp.com/send?phone=" + cleanDigits + "&text=" + Uri.encode(message)));
                intent.setPackage("com.whatsapp");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                try {
                    String cleanDigits = phone.replaceAll("[^0-9]", "");
                    if (cleanDigits.length() == 10) cleanDigits = "91" + cleanDigits;
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://api.whatsapp.com/send?phone=" + cleanDigits + "&text=" + Uri.encode(message)));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }

        @JavascriptInterface
        public void shareNative(String title, String message) {
            try {
                Intent sendIntent = new Intent();
                sendIntent.setAction(Intent.ACTION_SEND);
                sendIntent.putExtra(Intent.EXTRA_TEXT, message);
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                sendIntent.setType("text/plain");
                Intent shareIntent = Intent.createChooser(sendIntent, title);
                shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(shareIntent);
            } catch (Exception e) {
                e.printStackTrace();
            }
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

            boolean bothEngaged = (isVolumeUpPressed && isVolumeDownPressed) ||
                (lastVolumeUpTime > 0 && lastVolumeDownTime > 0 && Math.abs(lastVolumeUpTime - lastVolumeDownTime) <= 1200);

            if (bothEngaged) {
                if (now - lastChordTriggerTime > 1500) {
                    lastChordTriggerTime = now;
                    triggerMicActivation();
                }
                return true;
            }
        }

        return super.dispatchKeyEvent(event);
    }

    private void triggerMicActivation() {
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
