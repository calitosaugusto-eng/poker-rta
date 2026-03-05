package com.pokerrta.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.pokerrta.screencapture.ScreenCapturePlugin;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            registerPlugin(ScreenCapturePlugin.class);
            super.onCreate(savedInstanceState);
            Log.d(TAG, "MainActivity criada com sucesso");
        } catch (Exception e) {
            Log.e(TAG, "Erro no onCreate: " + e.getMessage(), e);
        }
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        try {
            Log.d(TAG, "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
            
            if (requestCode == ScreenCapturePlugin.SCREEN_CAPTURE_REQUEST_CODE) {
                ScreenCapturePlugin.handleActivityResult(requestCode, resultCode, data);
            }
            
            super.onActivityResult(requestCode, resultCode, data);
        } catch (Exception e) {
            Log.e(TAG, "Erro no onActivityResult: " + e.getMessage(), e);
        }
    }
}
