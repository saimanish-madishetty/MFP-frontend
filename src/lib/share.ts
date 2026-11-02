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
