package com.mahadeva.foodproducts.widgets;

/** Home-screen widget: open orders. */
public class OrdersWidget extends BaseWidget {
    @Override
    WidgetStore.Kind kind() {
        return WidgetStore.Kind.ORDERS;
    }
}
