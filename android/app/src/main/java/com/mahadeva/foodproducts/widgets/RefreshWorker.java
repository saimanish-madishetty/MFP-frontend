package com.mahadeva.foodproducts.widgets;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Fetches widget data off the main thread; allowed to wait for the server to wake up. */
public class RefreshWorker extends Worker {
    public RefreshWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        WidgetStore.fetch(getApplicationContext());
        return Result.success();
    }
}
