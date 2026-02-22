package com.pokerrta.screencapture;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

@CapacitorPlugin(
    name = "ScreenCapture",
    permissions = {
        @Permission(
            alias = "screenCapture",
            strings = { Manifest.permission.FOREGROUND_SERVICE }
        )
    }
)
public class ScreenCapturePlugin extends Plugin {

    private static final int SCREEN_CAPTURE_REQUEST_CODE = 1001;

    private MediaProjectionManager projectionManager;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private int screenWidth;
    private int screenHeight;
    private int screenDensity;
    private boolean isCapturing = false;
    private PluginCall savedCall;

    @Override
    public void load() {
        projectionManager = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);

        DisplayMetrics metrics = new DisplayMetrics();
        WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
        wm.getDefaultDisplay().getRealMetrics(metrics);
        screenWidth = metrics.widthPixels;
        screenHeight = metrics.heightPixels;
        screenDensity = metrics.densityDpi;
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        savedCall = call;
        Intent intent = projectionManager.createScreenCaptureIntent();
        startActivityForResult(call, intent, SCREEN_CAPTURE_REQUEST_CODE);
    }

    @PluginMethod
    public void startCapture(PluginCall call) {
        if (isCapturing) {
            call.resolve();
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
                mediaProjection = projectionManager.getMediaProjection(resultCode, data);
                startVirtualDisplay();
                isCapturing = true;

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

    private void startVirtualDisplay() {
        imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2);

        virtualDisplay = mediaProjection.createVirtualDisplay("ScreenCapture",
            screenWidth, screenHeight, screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(), null, null);
    }

    @PluginMethod
    public void captureFrame(PluginCall call) {
        if (!isCapturing || imageReader == null) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Captura não iniciada");
            call.resolve(result);
            return;
        }

        Image image = imageReader.acquireLatestImage();
        if (image == null) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Nenhum frame disponível");
            call.resolve(result);
            return;
        }

        try {
            // Converter Image para Bitmap
            final Image.Plane[] planes = image.getPlanes();
            final ByteBuffer buffer = planes[0].getBuffer();
            int pixelStride = planes[0].getPixelStride();
            int rowStride = planes[0].getRowStride();
            int rowPadding = rowStride - pixelStride * screenWidth;

            Bitmap bitmap = Bitmap.createBitmap(screenWidth + rowPadding / pixelStride,
                screenHeight, Bitmap.Config.ARGB_8888);
            bitmap.copyPixelsFromBuffer(buffer);

            // Crop para remover padding
            if (rowPadding > 0) {
                bitmap = Bitmap.createBitmap(bitmap, 0, 0, screenWidth, screenHeight);
            }

            // Converter para Base64
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream);
            byte[] byteArray = outputStream.toByteArray();
            String base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP);
            String dataUrl = "data:image/jpeg;base64," + base64;

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("imageData", dataUrl);
            result.put("width", screenWidth);
            result.put("height", screenHeight);
            call.resolve(result);

            bitmap.recycle();
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Erro ao capturar: " + e.getMessage());
            call.resolve(result);
        } finally {
            image.close();
        }
    }

    @PluginMethod
    public void stopCapture(PluginCall call) {
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }

        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }

        if (imageReader != null) {
            imageReader.setOnImageAvailableListener(null, null);
            imageReader = null;
        }

        isCapturing = false;

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Captura parada");
        call.resolve(result);
    }

    @PluginMethod
    public void isCapturing(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isCapturing", isCapturing);
        call.resolve(result);
    }
}
