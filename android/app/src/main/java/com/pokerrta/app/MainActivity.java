package com.pokerrta.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.pokerrta.screencapture.ScreenCapturePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registrar plugin nativo de screen capture
        registerPlugin(ScreenCapturePlugin.class);

        super.onCreate(savedInstanceState);
    }
}
