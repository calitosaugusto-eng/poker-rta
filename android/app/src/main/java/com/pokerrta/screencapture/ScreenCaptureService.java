package com.pokerrta.screencapture;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;

import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class ScreenCaptureService extends Service {

    private static final String TAG = "ScreenCaptureService";
    private static final String CHANNEL_ID = "screen_capture_channel";
    private static final int NOTIFICATION_ID = 1;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private int screenWidth;
    private int screenHeight;
    private int screenDensity;

    private static ScreenCaptureService instance;
    private static String lastCaptureData = null;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "=== Service onCreate ===");
        
        try {
            instance = this;
            createNotificationChannel();

            DisplayMetrics metrics = new DisplayMetrics();
            WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
            if (wm != null) {
                wm.getDefaultDisplay().getRealMetrics(metrics);
                screenWidth = metrics.widthPixels;
                screenHeight = metrics.heightPixels;
                screenDensity = metrics.densityDpi;
                Log.d(TAG, "Screen: " + screenWidth + "x" + screenHeight);
            } else {
                Log.e(TAG, "WindowManager é null!");
                // Usar valores padrão
                screenWidth = 1080;
                screenHeight = 1920;
                screenDensity = 420;
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro no onCreate: " + e.getMessage(), e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "=== Service onStartCommand ===");
        
        try {
            if (intent == null) {
                Log.e(TAG, "Intent é null!");
                stopSelf();
                return START_NOT_STICKY;
            }
            
            int resultCode = intent.getIntExtra("resultCode", -1);
            Intent data = intent.getParcelableExtra("data");

            Log.d(TAG, "resultCode: " + resultCode + ", data: " + (data != null ? "OK" : "null"));

            if (resultCode == -1 || data == null) {
                Log.e(TAG, "Dados inválidos");
                stopSelf();
                return START_NOT_STICKY;
            }

            // Criar notificação primeiro (obrigatório para foreground service)
            startForeground(NOTIFICATION_ID, createNotification());
            Log.d(TAG, "Foreground iniciado");

            // Obter MediaProjection
            MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (mpm == null) {
                Log.e(TAG, "MediaProjectionManager é null!");
                stopSelf();
                return START_NOT_STICKY;
            }

            mediaProjection = mpm.getMediaProjection(resultCode, data);
            if (mediaProjection == null) {
                Log.e(TAG, "MediaProjection é null!");
                stopSelf();
                return START_NOT_STICKY;
            }
            
            Log.d(TAG, "MediaProjection OK, iniciando VirtualDisplay...");
            startVirtualDisplay();
            
        } catch (Exception e) {
            Log.e(TAG, "ERRO no onStartCommand: " + e.getMessage(), e);
            stopSelf();
        }

        return START_STICKY;
    }

    private void createNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Screen Capture",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Poker RTA Screen Capture");
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao criar notification channel: " + e.getMessage());
        }
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Poker RTA")
            .setContentText("Captura de tela ativa")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }

    private void startVirtualDisplay() {
        try {
            Log.d(TAG, "Criando ImageReader...");
            imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2);

            Log.d(TAG, "Criando VirtualDisplay...");
            virtualDisplay = mediaProjection.createVirtualDisplay(
                "ScreenCapture",
                screenWidth, screenHeight, screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                new Handler(Looper.getMainLooper())
            );
            
            Log.d(TAG, "VirtualDisplay criado com SUCESSO!");
        } catch (Exception e) {
            Log.e(TAG, "ERRO ao criar VirtualDisplay: " + e.getMessage(), e);
        }
    }

    public static String captureFrame() {
        if (instance == null) {
            Log.e(TAG, "instance é null");
            return null;
        }
        if (instance.imageReader == null) {
            Log.e(TAG, "imageReader é null");
            return null;
        }

        try {
            Image image = instance.imageReader.acquireLatestImage();
            if (image == null) {
                return lastCaptureData;
            }

            final Image.Plane[] planes = image.getPlanes();
            final ByteBuffer buffer = planes[0].getBuffer();
            int pixelStride = planes[0].getPixelStride();
            int rowStride = planes[0].getRowStride();
            int rowPadding = rowStride - pixelStride * instance.screenWidth;

            Bitmap bitmap = Bitmap.createBitmap(
                instance.screenWidth + rowPadding / pixelStride,
                instance.screenHeight, 
                Bitmap.Config.ARGB_8888
            );
            bitmap.copyPixelsFromBuffer(buffer);

            if (rowPadding > 0) {
                bitmap = Bitmap.createBitmap(bitmap, 0, 0, instance.screenWidth, instance.screenHeight);
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 70, outputStream);
            byte[] byteArray = outputStream.toByteArray();
            String base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP);
            lastCaptureData = "data:image/jpeg;base64," + base64;

            bitmap.recycle();
            image.close();
            
            Log.d(TAG, "Frame capturado: " + lastCaptureData.length() + " chars");
            return lastCaptureData;
            
        } catch (Exception e) {
            Log.e(TAG, "ERRO ao capturar frame: " + e.getMessage(), e);
            return lastCaptureData;
        }
    }

    public static boolean isRunning() {
        return instance != null && instance.mediaProjection != null;
    }

    public static void stop() {
        Log.d(TAG, "stop() chamado");
        if (instance != null) {
            instance.stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "=== Service onDestroy ===");
        try {
            if (virtualDisplay != null) {
                virtualDisplay.release();
                virtualDisplay = null;
            }
            if (mediaProjection != null) {
                mediaProjection.stop();
                mediaProjection = null;
            }
            imageReader = null;
            instance = null;
            lastCaptureData = null;
        } catch (Exception e) {
            Log.e(TAG, "Erro no onDestroy: " + e.getMessage());
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
