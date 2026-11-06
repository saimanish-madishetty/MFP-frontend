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
import java.util.concurrent.TimeUnit;

/**
 * Shared state for the home-screen widgets: the login (handed over by the app through WidgetsPlugin),
 * the last data fetched from GET /widgets, and drawing both widgets from it.
 *
 * To avoid flicker, the list is only reloaded when the data really changed; "Updating…" and
 * "Updated …" only touch the header and footer text (partial update).
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

    /** One list row and a key for it (same content → same key, so unchanged rows aren't redrawn). */
    static final class Row {
        final long id;
        final RemoteViews views;

        Row(long id, RemoteViews views) {
            this.id = id;
            this.views = views;
        }
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ── Login (from the app) ─────────────────────────────────

    static void setLogin(Context c, String token, String apiUrl) {
        SharedPreferences p = prefs(c);
        boolean sameLogin = token.equals(p.getString("token", null));
        SharedPreferences.Editor e = p.edit().putString("token", token).putString("apiUrl", apiUrl);
        if (!sameLogin) e.remove("data").remove("at");
        e.apply();
        if (!sameLogin) renderAll(c, true);
        refresh(c);
    }

    /** Logged out: forget the login and the data, so the widgets don't show it any more. */
    static void clearLogin(Context c) {
        prefs(c).edit().clear().apply();
        renderAll(c, true);
    }

    // ── Refreshing ───────────────────────────────────────────

    static boolean hasWidgets(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        return m.getAppWidgetIds(new ComponentName(c, StockWidget.class)).length > 0
                || m.getAppWidgetIds(new ComponentName(c, OrdersWidget.class)).length > 0;
    }

    /** Fetches fresh data now (↻, login, leaving the app). */
    static void refresh(Context c) {
        refresh(c, true);
    }

    /**
     * Fetches fresh data in the background (WorkManager), if any widget is on the home screen.
     * Automatic refreshes (`force` false, Android's periodic update) are skipped when the last
     * try was less than {@link #AUTO_GAP_MS} ago, so nothing can call the backend in a loop.
     */
    static void refresh(Context c, boolean force) {
        keepWorkManagerAlive(c);
        SharedPreferences p = prefs(c);
        if (!hasWidgets(c) || p.getString("token", null) == null) return;
        long now = System.currentTimeMillis();
        if (!force && now - p.getLong("lastTry", 0) < AUTO_GAP_MS) return;
        p.edit().putString("status", LOADING).putLong("lastTry", now).apply();
        renderText(c);
        WorkManager.getInstance(c).enqueueUniqueWork(
                WORK, ExistingWorkPolicy.KEEP, new OneTimeWorkRequest.Builder(RefreshWorker.class).build());
    }

    /** Minimum time between automatic refreshes. */
    private static final long AUTO_GAP_MS = 15 * 60 * 1000L;

    /** See {@link KeepAliveWorker}: always one far-future job queued. */
    private static void keepWorkManagerAlive(Context c) {
        WorkManager.getInstance(c).enqueueUniqueWork(
                WORK + "-keepalive",
                ExistingWorkPolicy.KEEP,
                new OneTimeWorkRequest.Builder(KeepAliveWorker.class)
                        .setInitialDelay(3650, TimeUnit.DAYS)
                        .build());
    }

    /** Runs on a background thread (RefreshWorker). The server may take ~1 min to wake up. */
    static void fetch(Context c) {
        SharedPreferences p = prefs(c);
        String token = p.getString("token", null);
        String apiUrl = p.getString("apiUrl", null);
        if (token == null || apiUrl == null) return;
        String status = ERROR;
        boolean changed = false;
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
                renderAll(c, true);
                return;
            }
            if (code == 200) {
                String body = read(con.getInputStream());
                new JSONObject(body); // must be valid before it replaces the last good data
                changed = !body.equals(p.getString("data", null));
                p.edit().putString("data", body).putLong("at", System.currentTimeMillis()).apply();
                status = OK;
            }
        } catch (Exception ignored) {
            // Offline or server asleep: keep showing the last data.
        } finally {
            if (con != null) con.disconnect();
        }
        p.edit().putString("status", status).apply();
        if (changed) renderAll(c, true);
        else renderText(c);
    }

    private static String read(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    // ── Drawing ──────────────────────────────────────────────

    private static int[] ids(Context c, AppWidgetManager m, Kind kind) {
        Class<?> cls = kind == Kind.STOCK ? StockWidget.class : OrdersWidget.class;
        return m.getAppWidgetIds(new ComponentName(c, cls));
    }

    /** Redraws both widgets; `dataChanged` also reloads their lists. */
    static void renderAll(Context c, boolean dataChanged) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Kind kind : Kind.values()) {
            int[] ids = ids(c, m, kind);
            for (int id : ids) m.updateAppWidget(id, build(c, id, kind));
            if (dataChanged && ids.length > 0) m.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
        }
    }

    /** Full draw of one widget (added, resized, every 30 min). The list keeps its rows. */
    static void render(Context c, AppWidgetManager m, int id, Kind kind) {
        m.updateAppWidget(id, build(c, id, kind));
    }

    /** Only the header / footer / empty-list text: no flicker. */
    private static void renderText(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Kind kind : Kind.values()) {
            for (int id : ids(c, m, kind)) {
                RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_list);
                setText(c, v, kind);
                m.partiallyUpdateAppWidget(id, v);
            }
        }
    }

    /** Header, footer, click actions and the list adapter; the rows come from WidgetListService. */
    private static RemoteViews build(Context c, int widgetId, Kind kind) {
        boolean stock = kind == Kind.STOCK;
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_list);
        v.setTextViewText(R.id.widget_title, stock ? "Stock" : "Orders");
        PendingIntent open = openApp(c, stock ? "/stock/?tab=products" : "/orders/", stock ? 1 : 2, false);
        v.setOnClickPendingIntent(R.id.widget_header, open);
        v.setOnClickPendingIntent(R.id.widget_message, open);
        v.setOnClickPendingIntent(R.id.widget_refresh, refreshIntent(c, stock ? StockWidget.class : OrdersWidget.class, stock ? 3 : 4));

        // The list: one adapter per widget (the data URI keeps the intents apart). Setting the same
        // adapter again keeps the list as it is.
        Intent adapter = new Intent(c, WidgetListService.class)
                .putExtra(WidgetListService.EXTRA_KIND, kind.name())
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        adapter.setData(Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(R.id.widget_list, adapter);
        v.setEmptyView(R.id.widget_list, R.id.widget_message);
        // Tapping a row opens the same page (rows fill in this template).
        v.setPendingIntentTemplate(R.id.widget_list, openApp(c, stock ? "/stock/?tab=products" : "/orders/", stock ? 5 : 6, true));

        setText(c, v, kind);
        return v;
    }

    /** Summary, "Updated …" footer and the empty-list message, from the stored data and status. */
    private static void setText(Context c, RemoteViews v, Kind kind) {
        boolean stock = kind == Kind.STOCK;
        SharedPreferences p = prefs(c);
        if (p.getString("token", null) == null) {
            v.setTextViewText(R.id.widget_summary, "");
            v.setTextViewText(R.id.widget_message, "Open the app and log in to see " + (stock ? "stock." : "orders."));
            v.setTextViewText(R.id.widget_updated, "");
            return;
        }
        String status = p.getString("status", OK);
        String raw = p.getString("data", null);
        v.setTextViewText(R.id.widget_updated, footer(c, status, p.getLong("at", 0)));
        if (raw == null) {
            v.setTextViewText(R.id.widget_summary, "");
            v.setTextViewText(R.id.widget_message, LOADING.equals(status) ? "Loading…" : "Couldn't load. Tap ↻ to try again.");
            return;
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
                int open = o.getInt("open");
                int late = o.getInt("late");
                v.setTextViewText(R.id.widget_summary, open + " open" + (late > 0 ? " · " + late + " late" : ""));
                v.setTextViewText(R.id.widget_message, "No open orders.");
            }
        } catch (Exception e) {
            v.setTextViewText(R.id.widget_summary, "");
            v.setTextViewText(R.id.widget_message, "Couldn't read the data. Tap ↻ to try again.");
        }
    }

    /** Rows for a widget's list (called by WidgetListService on a background thread). */
    static List<Row> rows(Context c, Kind kind) {
        List<Row> rows = new ArrayList<>();
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
                // A size of a product with sizes: the product's name, and the size on the line below
                // (a long full name would be cut off right where the size is). Older data has no title.
                String size = it.optString("size", "");
                if (kind == Kind.STOCK) {
                    row.setTextViewText(R.id.row_title, it.optString("title", it.getString("name")));
                    if (size.isEmpty()) row.setViewVisibility(R.id.row_sub, View.GONE);
                    else row.setTextViewText(R.id.row_sub, size);
                    row.setTextViewText(R.id.row_value, it.getString("qty"));
                    if (it.getBoolean("out")) row.setTextColor(R.id.row_value, RED);
                } else {
                    row.setTextViewText(R.id.row_title, it.optString("productTitle", it.getString("product")));
                    String due = it.isNull("due") ? null : it.getString("due");
                    row.setTextViewText(R.id.row_sub, (size.isEmpty() ? "" : size + " · ")
                            + it.getString("buyer") + (due == null ? "" : " · by " + due));
                    row.setTextViewText(R.id.row_value, it.getString("qty"));
                    if (it.getBoolean("late")) row.setTextColor(R.id.row_value, RED);
                    else if (it.getBoolean("dueToday")) row.setTextColor(R.id.row_value, AMBER);
                }
                row.setOnClickFillInIntent(R.id.row_root, new Intent());
                // Content + position: a row that didn't change keeps its id.
                rows.add(new Row(((long) i << 32) ^ (it.toString().hashCode() & 0xffffffffL), row));
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
