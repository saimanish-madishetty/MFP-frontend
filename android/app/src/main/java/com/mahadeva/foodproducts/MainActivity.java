package com.mahadeva.foodproducts;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.mahadeva.foodproducts.widgets.WidgetsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugin: must be registered before the bridge starts.
        registerPlugin(WidgetsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
