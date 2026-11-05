package com.mahadeva.foodproducts.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

/** Shared behaviour of the two widgets: draw from the last data, then fetch fresh data. */
abstract class BaseWidget extends AppWidgetProvider {
    abstract WidgetStore.Kind kind();

    /**
     * Every ~30 minutes (Android's minimum), when the widget is added, and whenever Android thinks
     * the app changed. Automatic, so it fetches at most every 15 minutes (see WidgetStore.refresh).
     */
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) WidgetStore.render(c, m, id, kind());
        WidgetStore.refresh(c, false);
    }

    /** Resized: show as many rows as now fit. */
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        WidgetStore.render(c, m, id, kind());
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (WidgetStore.ACTION_REFRESH.equals(intent.getAction())) WidgetStore.refresh(c);
        else super.onReceive(c, intent);
    }
}
