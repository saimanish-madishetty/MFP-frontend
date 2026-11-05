package com.mahadeva.foodproducts.widgets;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the app hand its login to the widgets and ask them to refresh (src/lib/widgets.ts). */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {
    @PluginMethod
    public void setLogin(PluginCall call) {
        String token = call.getString("token");
        String apiUrl = call.getString("apiUrl");
        if (token == null || apiUrl == null) {
            call.reject("token and apiUrl are required");
            return;
        }
        WidgetStore.setLogin(getContext(), token, apiUrl);
        call.resolve();
    }

    @PluginMethod
    public void clearLogin(PluginCall call) {
        WidgetStore.clearLogin(getContext());
        call.resolve();
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        WidgetStore.refresh(getContext());
        call.resolve();
    }
}
