import { Capacitor } from "@capacitor/core";

/**
 * Shares a PDF.
 * - Android app: saves it to the app cache and opens the share sheet (pick WhatsApp, then the chat).
 * - Browser: uses the browser's share sheet when it supports files; otherwise downloads the file.
 */
export async function sharePdf(opts: { base64: string; blob: Blob; fileName: string; text: string }) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const file = await Filesystem.writeFile({ path: opts.fileName, data: opts.base64, directory: Directory.Cache });
    await Share.share({ title: opts.fileName, text: opts.text, files: [file.uri], dialogTitle: "Share invoice" });
    return "shared";
  }

  const file = new File([opts.blob], opts.fileName, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: opts.text, title: opts.fileName });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(opts.blob, opts.fileName);
  return "downloaded";
}

/**
 * Saves a PDF.
 * - Android app: writes it to the phone's Documents/MFP Invoices folder (a WebView ignores
 *   browser downloads). If that fails, opens the share sheet so it can be saved to Files/Drive.
 * - Browser: normal download.
 * Returns where it went, for a message.
 */
export async function savePdf(opts: { base64: string; blob: Blob; fileName: string }): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(opts.blob, opts.fileName);
    return "downloaded";
  }
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const folder = "MFP Invoices";
  try {
    // Asks for storage permission on Android 10 and older; newer phones don't need it.
    const perm = await Filesystem.requestPermissions().catch(() => null);
    if (perm && perm.publicStorage === "denied") throw new Error("Storage permission denied");
    await Filesystem.writeFile({
      path: `${folder}/${opts.fileName}`,
      data: opts.base64,
      directory: Directory.Documents,
      recursive: true,
    });
    return `Saved to Documents/${folder}/${opts.fileName}`;
  } catch {
    const { Share } = await import("@capacitor/share");
    const file = await Filesystem.writeFile({ path: opts.fileName, data: opts.base64, directory: Directory.Cache });
    await Share.share({ title: opts.fileName, files: [file.uri], dialogTitle: "Save invoice" });
    return "shared";
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
