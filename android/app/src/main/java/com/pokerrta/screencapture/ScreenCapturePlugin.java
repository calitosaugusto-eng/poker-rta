package com.pokerrta.screencapture;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenCapture")
public class ScreenCapturePlugin extends Plugin {

    private static final String TAG = "ScreenCapturePlugin";
    public static final int SCREEN_CAPTURE_REQUEST_CODE = 1001;
    private static PluginCall pendingCall = null;
    private static Activity pendingActivity = null;

    @PluginMethod
    public void startCapture(PluginCall call) {
        Log.d(TAG, "=== startCapture chamado ===");
        
        try {
            if (ScreenCaptureService.isRunning()) {
                Log.d(TAG, "Captura já está ativa");
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("message", "Captura já está ativa");
                call.resolve(result);
                return;
            }

            Activity activity = getActivity();
            if (activity == null) {
                Log.e(TAG, "Activity é null!");
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("message", "Erro: Activity não disponível");
                call.resolve(result);
                return;
            }

            MediaProjectionManager mpm = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (mpm == null) {
                Log.e(TAG, "MediaProjectionManager é null!");
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("message", "Erro: MediaProjectionManager não disponível");
                call.resolve(result);
                return;
            }

            // Salvar call e activity
            pendingCall = call;
            pendingActivity = activity;
            
            Log.d(TAG, "Iniciando screen capture intent...");
            Intent intent = mpm.createScreenCaptureIntent();
            activity.startActivityForResult(intent, SCREEN_CAPTURE_REQUEST_CODE);
            
        } catch (Exception e) {
            Log.e(TAG, "ERRO em startCapture: " + e.getMessage(), e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Erro: " + e.getMessage());
            call.resolve(result);
            pendingCall = null;
            pendingActivity = null;
        }
    }

    public static void handleActivityResult(int requestCode, int resultCode, Intent data) {
        Log.d(TAG, "=== handleActivityResult === requestCode=" + requestCode + ", resultCode=" + resultCode);
        
        if (requestCode != SCREEN_CAPTURE_REQUEST_CODE) return;
        if (pendingCall == null) {
            Log.e(TAG, "pendingCall é null!");
            return;
        }
        if (pendingActivity == null) {
            Log.e(TAG, "pendingActivity é null!");
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Erro: Activity não disponível");
            pendingCall.resolve(result);
            pendingCall = null;
            return;
        }

        try {
            if (resultCode == Activity.RESULT_OK && data != null) {
                Log.d(TAG, "Usuário permitiu! Iniciando serviço...");
                
                Intent serviceIntent = new Intent(pendingActivity, ScreenCaptureService.class);
                serviceIntent.putExtra("resultCode", resultCode);
                serviceIntent.putExtra("data", data);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    pendingActivity.startForegroundService(serviceIntent);
                } else {
                    pendingActivity.startService(serviceIntent);
                }
                
                Log.d(TAG, "Serviço iniciado!");
                
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("message", "Captura iniciada");
                pendingCall.resolve(result);
            } else {
                Log.d(TAG, "Usuário negou ou cancelou");
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("message", "Permissão negada");
                pendingCall.resolve(result);
            }
        } catch (Exception e) {
            Log.e(TAG, "ERRO em handleActivityResult: " + e.getMessage(), e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Erro: " + e.getMessage());
            pendingCall.resolve(result);
        }
        
        pendingCall = null;
        pendingActivity = null;
    }

    @PluginMethod
    public void captureFrame(PluginCall call) {
        Log.d(TAG, "=== captureFrame ===");
        
        try {
            if (!ScreenCaptureService.isRunning()) {
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("message", "Captura não iniciada");
                call.resolve(result);
                return;
            }

            String imageData = ScreenCaptureService.captureFrame();
            if (imageData != null) {
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("imageData", imageData);
                call.resolve(result);
            } else {
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("message", "Nenhum frame disponível");
                call.resolve(result);
            }
        } catch (Exception e) {
            Log.e(TAG, "ERRO em captureFrame: " + e.getMessage(), e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Erro: " + e.getMessage());
            call.resolve(result);
        }
    }

    @PluginMethod
    public void stopCapture(PluginCall call) {
        Log.d(TAG, "=== stopCapture ===");
        ScreenCaptureService.stop();
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void isCapturing(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isCapturing", ScreenCaptureService.isRunning());
        call.resolve(result);
    }
}
