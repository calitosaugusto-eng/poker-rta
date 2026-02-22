package com.pokerrta.screencapture;

import android.app.Activity;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenCapture")
public class ScreenCapturePlugin extends Plugin {

    private static final int SCREEN_CAPTURE_REQUEST_CODE = 1001;
    private MediaProjectionManager projectionManager;
    private PluginCall savedCall;

    @Override
    public void load() {
        projectionManager = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
    }

    @PluginMethod
    public void startCapture(PluginCall call) {
        if (ScreenCaptureService.isRunning()) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Captura já está ativa");
            call.resolve(result);
            return;
        }

        savedCall = call;
        Intent intent = projectionManager.createScreenCaptureIntent();
        startActivityForResult(call, intent, SCREEN_CAPTURE_REQUEST_CODE);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (requestCode == SCREEN_CAPTURE_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                // Iniciar serviço de captura
                Intent serviceIntent = new Intent(getContext(), ScreenCaptureService.class);
                serviceIntent.putExtra("resultCode", resultCode);
                serviceIntent.putExtra("data", data);

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    getContext().startForegroundService(serviceIntent);
                } else {
                    getContext().startService(serviceIntent);
                }

                if (savedCall != null) {
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("message", "Captura de tela iniciada");
                    savedCall.resolve(result);
                }
            } else {
                if (savedCall != null) {
                    JSObject result = new JSObject();
                    result.put("success", false);
                    result.put("message", "Permissão negada pelo usuário");
                    savedCall.resolve(result);
                }
            }
        }
    }

    @PluginMethod
    public void captureFrame(PluginCall call) {
        if (!ScreenCaptureService.isRunning()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Captura não iniciada. Chame startCapture primeiro.");
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
            result.put("message", "Nenhum frame disponível. Tente novamente.");
            call.resolve(result);
        }
    }

    @PluginMethod
    public void stopCapture(PluginCall call) {
        ScreenCaptureService.stop();

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Captura parada");
        call.resolve(result);
    }

    @PluginMethod
    public void isCapturing(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isCapturing", ScreenCaptureService.isRunning());
        call.resolve(result);
    }
}
