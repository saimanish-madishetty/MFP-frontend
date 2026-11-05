package com.mahadeva.foodproducts.widgets;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Does nothing; it is queued years ahead so WorkManager always has pending work.
 *
 * Why: when WorkManager runs out of work it disables one of its own receivers. Android reports
 * that as "the app changed" and sends every widget an update, which started a refresh, which
 * queued work, which enabled the receiver again… a loop that redrew the widgets every second and
 * kept calling the backend. With this always queued, the receiver is never switched off.
 */
public class KeepAliveWorker extends Worker {
    public KeepAliveWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        return Result.success();
    }
}
