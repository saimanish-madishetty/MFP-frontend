/**
 * Light / dark theme, chosen in Settings and kept on this device. "system" follows the phone.
 * The page carries the result as <html data-theme="light|dark">; globals.css colours from it.
 */
export type ThemeChoice = "light" | "dark" | "system";

const KEY = "mfp-theme";
const DARK = "(prefers-color-scheme: dark)";

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Puts the chosen (or the phone's) theme on the page. */
export function applyTheme(choice: ThemeChoice = getTheme()) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia(DARK).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the choice still applies until the app is closed.
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(CHANGED));
}

const CHANGED = "mfp:theme";

/** For useSyncExternalStore: re-reads the choice when Settings changes it. */
export function subscribeTheme(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

/** While "Same as phone" is chosen, follows the phone switching between light and dark. */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia(DARK);
  const onChange = () => getTheme() === "system" && applyTheme("system");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Runs in <head> before the page paints, so it never flashes the wrong colours. Same logic as
 * `applyTheme` (it can't import it).
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK}").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;
