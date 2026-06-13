import { spawn } from "child_process";

/** Best-effort: open the local watch page in the default browser.
 *  Disable with NO_OPEN=1 (e.g. headless boxes). Never throws. */
export function openBrowser(url: string): void {
  if (process.env.NO_OPEN) return;
  try {
    if (process.platform === "win32") {
      // "start" is a cmd builtin; the empty "" is the window title so the URL
      // isn't consumed as one.
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    } else {
      const cmd = process.platform === "darwin" ? "open" : "xdg-open";
      spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch { /* best effort */ }
}
