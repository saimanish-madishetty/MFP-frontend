package com.mahadeva.foodproducts.widgets;

/** Home-screen widget: products in stock. */
public class StockWidget extends BaseWidget {
    @Override
    WidgetStore.Kind kind() {
        return WidgetStore.Kind.STOCK;
    }
}
