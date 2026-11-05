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
        private List<WidgetStore.Row> rows = new ArrayList<>();

        Factory(Context context, WidgetStore.Kind kind) {
            this.context = context;
            this.kind = kind;
        }

        @Override public void onCreate() {}

        /** Called when the list is created and after notifyAppWidgetViewDataChanged (new data). */
        @Override
        public void onDataSetChanged() {
            rows = WidgetStore.rows(context, kind);
        }

        @Override public void onDestroy() { rows.clear(); }
        @Override public int getCount() { return rows.size(); }

        @Override
        public RemoteViews getViewAt(int position) {
            return position < rows.size() ? rows.get(position).views : blank();
        }

        /** Shown while a row is being prepared; blank instead of Android's "Loading…" text. */
        @Override public RemoteViews getLoadingView() { return blank(); }
        @Override public int getViewTypeCount() { return 1; }

        @Override
        public long getItemId(int position) {
            return position < rows.size() ? rows.get(position).id : position;
        }

        /** Unchanged rows keep their id, so a refresh only redraws what changed. */
        @Override public boolean hasStableIds() { return true; }

        private RemoteViews blank() {
            return new RemoteViews(context.getPackageName(), R.layout.widget_row);
        }
    }
}
