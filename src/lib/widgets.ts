import { Capacitor, registerPlugin } from "@capacitor/core";
import { API_URL } from "./api";

/** Native side: android/app/src/main/java/com/mahadeva/foodproducts/widgets/WidgetsPlugin.java */
type WidgetsPlugin = {
  setLogin(o: { token: string; apiUrl: string }): Promise<void>;
  clearLogin(): Promise<void>;
  refresh(): Promise<void>;
};

const Widgets = registerPlugin<WidgetsPlugin>("Widgets");
const onAndroid = () => Capacitor.getPlatform() === "android";

/** Home-screen widgets fetch data themselves, with the app's login. Logged out: they show nothing. */
export function syncWidgetLogin(token: string | null) {
  if (!onAndroid()) return;
  (token ? Widgets.setLogin({ token, apiUrl: API_URL }) : Widgets.clearLogin()).catch(() => {});
}

/** Called when leaving the app, so widgets show what was just changed. */
export function refreshWidgets() {
  if (onAndroid()) Widgets.refresh().catch(() => {});
}

/** Widget taps open the app on a page, as "<scheme>://app/orders/". Returns that page's path. */
export function widgetPath(url: string): string | null {
  try {
    const u = new URL(url);
    return u.host === "app" && u.pathname.startsWith("/") ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}
