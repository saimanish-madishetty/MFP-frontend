package com.mahadeva.foodproducts.widgets;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import com.mahadeva.foodproducts.R;

import java.util.ArrayList;
import java.util.List;

/** Supplies the rows of a widget's scrolling list (Stock or Orders) from the last fetched data. */
public class WidgetListService extends RemoteViewsService {
    static final String EXTRA_KIND = "kind";

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        WidgetStore.Kind kind = WidgetStore.Kind.valueOf(intent.getStringExtra(EXTRA_KIND));
        return new Factory(getApplicationContext(), kind);
    }

    private static final class Factory implements RemoteViewsFactory {
        private final Context context;
        private final WidgetStore.Kind kind;
        private List<RemoteViews> rows = new ArrayList<>();

        Factory(Context context, WidgetStore.Kind kind) {
            this.context = context;
            this.kind = kind;
        }

        @Override public void onCreate() {}

        /** Called after AppWidgetManager.notifyAppWidgetViewDataChanged (new data, login change). */
        @Override
        public void onDataSetChanged() {
            rows = WidgetStore.rows(context, kind);
        }

        @Override public void onDestroy() { rows.clear(); }
        @Override public int getCount() { return rows.size(); }
        @Override public RemoteViews getViewAt(int position) {
            return position < rows.size() ? rows.get(position) : new RemoteViews(context.getPackageName(), R.layout.widget_row);
        }
        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int position) { return position; }
        @Override public boolean hasStableIds() { return false; }
    }
}
