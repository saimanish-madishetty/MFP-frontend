package com.mahadeva.foodproducts.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.text.format.DateUtils;
import android.view.View;
import android.widget.RemoteViews;

import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import com.mahadeva.foodproducts.MainActivity;
import com.mahadeva.foodproducts.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * Shared state for the home-screen widgets: the login (handed over by the app through WidgetsPlugin),
 * the last data fetched from GET /widgets, and drawing both widgets from it.
 */
public final class WidgetStore {
    private WidgetStore() {}

    static final String ACTION_REFRESH = "com.mahadeva.foodproducts.WIDGET_REFRESH";
    private static final String PREFS = "mfp_widgets";
    private static final String WORK = "mfp-widgets-refresh";

    private static final int RED = Color.parseColor("#DC2626");
    private static final int AMBER = Color.parseColor("#D97706");

    // Status of the last refresh
    private static final String OK = "ok";
    private static final String LOADING = "loading";
    private static final String ERROR = "error";

    enum Kind { STOCK, ORDERS }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ── Login (from the app) ─────────────────────────────────

    static void setLogin(Context c, String token, String apiUrl) {
        SharedPreferences p = prefs(c);
        boolean sameUser = token.equals(p.getString("token", null));
        SharedPreferences.Editor e = p.edit().putString("token", token).putString("apiUrl", apiUrl);
        if (!sameUser) e.remove("data").remove("at");
        e.apply();
        refresh(c);
    }

    /** Logged out: forget the login and the data, so the widgets don't show it any more. */
    static void clearLogin(Context c) {
        prefs(c).edit().clear().apply();
        renderAll(c);
    }

    // ── Refreshing ───────────────────────────────────────────

    static boolean hasWidgets(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        return m.getAppWidgetIds(new ComponentName(c, StockWidget.class)).length > 0
                || m.getAppWidgetIds(new ComponentName(c, OrdersWidget.class)).length > 0;
    }

    /** Fetches fresh data in the background (WorkManager), if any widget is on the home screen. */
    static void refresh(Context c) {
        if (!hasWidgets(c) || prefs(c).getString("token", null) == null) {
            renderAll(c);
            return;
        }
        prefs(c).edit().putString("status", LOADING).apply();
        renderAll(c);
        WorkManager.getInstance(c).enqueueUniqueWork(
                WORK, ExistingWorkPolicy.KEEP, new OneTimeWorkRequest.Builder(RefreshWorker.class).build());
    }

    /** Runs on a background thread (RefreshWorker). The server may take ~1 min to wake up. */
    static void fetch(Context c) {
        SharedPreferences p = prefs(c);
        String token = p.getString("token", null);
        String apiUrl = p.getString("apiUrl", null);
        if (token == null || apiUrl == null) return;
        String status = ERROR;
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(apiUrl + "/widgets").openConnection();
            con.setConnectTimeout(30_000);
            con.setReadTimeout(90_000);
            con.setRequestProperty("Authorization", "Bearer " + token);
            con.setRequestProperty("Accept", "application/json");
            int code = con.getResponseCode();
            if (code == 401) {
                // Login ended (PIN reset, access turned off, …): the app asks to log in again.
                p.edit().clear().apply();
                renderAll(c);
                return;
            }
            if (code == 200) {
                String body = read(con.getInputStream());
                new JSONObject(body); // must be valid before it replaces the last good data
                p.edit().putString("data", body).putLong("at", System.currentTimeMillis()).apply();
                status = OK;
            }
        } catch (Exception ignored) {
            // Offline or server asleep: keep showing the last data.
        } finally {
            if (con != null) con.disconnect();
        }
        p.edit().putString("status", status).apply();
        renderAll(c);
    }

    private static String read(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    // ── Drawing ──────────────────────────────────────────────

    static void renderAll(Context c) {
        render(c, Kind.STOCK);
        render(c, Kind.ORDERS);
    }

    static void render(Context c, Kind kind) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        Class<?> cls = kind == Kind.STOCK ? StockWidget.class : OrdersWidget.class;
        int[] ids = m.getAppWidgetIds(new ComponentName(c, cls));
        for (int id : ids) render(c, m, id, kind);
    }

    static void render(Context c, AppWidgetManager m, int id, Kind kind) {
        m.updateAppWidget(id, build(c, id, kind));
        // Reload the scrolling list (WidgetListService) from the latest data.
        m.notifyAppWidgetViewDataChanged(id, R.id.widget_list);
    }

    /** Header, footer and the empty-list message; the rows come from WidgetListService. */
    private static RemoteViews build(Context c, int widgetId, Kind kind) {
        boolean stock = kind == Kind.STOCK;
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_list);
        v.setTextViewText(R.id.widget_title, stock ? "Stock" : "Orders");
        PendingIntent open = openApp(c, stock ? "/stock/?tab=products" : "/orders/", stock ? 1 : 2, false);
        v.setOnClickPendingIntent(R.id.widget_header, open);
        v.setOnClickPendingIntent(R.id.widget_message, open);
        v.setOnClickPendingIntent(R.id.widget_refresh, refreshIntent(c, stock ? StockWidget.class : OrdersWidget.class, stock ? 3 : 4));

        // The list: one adapter per widget (the data URI keeps the intents apart).
        Intent adapter = new Intent(c, WidgetListService.class)
                .putExtra(WidgetListService.EXTRA_KIND, kind.name())
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        adapter.setData(Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(R.id.widget_list, adapter);
        v.setEmptyView(R.id.widget_list, R.id.widget_message);
        // Tapping a row opens the same page (rows fill in this template).
        v.setPendingIntentTemplate(R.id.widget_list, openApp(c, stock ? "/stock/?tab=products" : "/orders/", stock ? 5 : 6, true));

        SharedPreferences p = prefs(c);
        if (p.getString("token", null) == null) {
            v.setTextViewText(R.id.widget_summary, "");
            v.setTextViewText(R.id.widget_message, "Open the app and log in to see " + (stock ? "stock." : "orders."));
            v.setTextViewText(R.id.widget_updated, "");
            return v;
        }
        String status = p.getString("status", OK);
        String raw = p.getString("data", null);
        v.setTextViewText(R.id.widget_updated, footer(c, status, p.getLong("at", 0)));
        v.setTextViewText(R.id.widget_summary, "");
        if (raw == null) {
            v.setTextViewText(R.id.widget_message, LOADING.equals(status) ? "Loading…" : "Couldn't load. Tap ↻ to try again.");
            return v;
        }
        try {
            JSONObject data = new JSONObject(raw);
            if (stock) {
                JSONObject s = data.getJSONObject("stock");
                int products = s.getInt("products");
                int out = s.getInt("outOfStock");
                v.setTextViewText(R.id.widget_summary,
                        products + " product" + (products == 1 ? "" : "s") + (out > 0 ? " · " + out + " out of stock" : ""));
                v.setTextViewText(R.id.widget_message, "No products yet.");
            } else {
                JSONObject o = data.getJSONObject("orders");
                int open2 = o.getInt("open");
                int late = o.getInt("late");
                v.setTextViewText(R.id.widget_summary, open2 + " open" + (late > 0 ? " · " + late + " late" : ""));
                v.setTextViewText(R.id.widget_message, "No open orders.");
            }
        } catch (Exception e) {
            v.setTextViewText(R.id.widget_message, "Couldn't read the data. Tap ↻ to try again.");
        }
        return v;
    }

    /** Rows for a widget's list (called by WidgetListService on a background thread). */
    static List<RemoteViews> rows(Context c, Kind kind) {
        List<RemoteViews> rows = new ArrayList<>();
        SharedPreferences p = prefs(c);
        String raw = p.getString("data", null);
        if (p.getString("token", null) == null || raw == null) return rows;
        try {
            JSONObject data = new JSONObject(raw);
            JSONArray items = kind == Kind.STOCK
                    ? data.getJSONObject("stock").getJSONArray("items")
                    : data.getJSONObject("orders").getJSONArray("items");
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.getJSONObject(i);
                RemoteViews row = new RemoteViews(c.getPackageName(), R.layout.widget_row);
                if (kind == Kind.STOCK) {
                    row.setTextViewText(R.id.row_title, it.getString("name"));
                    row.setViewVisibility(R.id.row_sub, View.GONE);
                    row.setTextViewText(R.id.row_value, it.getString("qty"));
                    if (it.getBoolean("out")) row.setTextColor(R.id.row_value, RED);
                } else {
                    row.setTextViewText(R.id.row_title, it.getString("product"));
                    String due = it.isNull("due") ? null : it.getString("due");
                    row.setTextViewText(R.id.row_sub, it.getString("buyer") + (due == null ? "" : " · by " + due));
                    row.setTextViewText(R.id.row_value, it.getString("qty"));
                    if (it.getBoolean("late")) row.setTextColor(R.id.row_value, RED);
                    else if (it.getBoolean("dueToday")) row.setTextColor(R.id.row_value, AMBER);
                }
                row.setOnClickFillInIntent(R.id.row_root, new Intent());
                rows.add(row);
            }
        } catch (Exception ignored) {
            // Bad data: show the list empty (the header says so).
        }
        return rows;
    }

    private static String footer(Context c, String status, long at) {
        if (LOADING.equals(status)) return "Updating…";
        if (at == 0) return "";
        int flags = DateUtils.FORMAT_SHOW_TIME;
        if (!DateUtils.isToday(at)) flags |= DateUtils.FORMAT_SHOW_DATE | DateUtils.FORMAT_ABBREV_MONTH;
        String when = DateUtils.formatDateTime(c, at, flags);
        return ERROR.equals(status) ? "Couldn't update · from " + when : "Updated " + when;
    }

    /**
     * Opens the app on `path` (the app handles it through @capacitor/app's appUrlOpen).
     * A list's click template must be mutable so each row can fill it in; the intent is explicit.
     */
    private static PendingIntent openApp(Context c, String path, int requestCode, boolean template) {
        String scheme = c.getString(R.string.custom_url_scheme);
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(scheme + "://app" + path), c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int mutability = template ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | mutability);
    }

    private static PendingIntent refreshIntent(Context c, Class<?> provider, int requestCode) {
        Intent i = new Intent(c, provider).setAction(ACTION_REFRESH);
        return PendingIntent.getBroadcast(c, requestCode, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
