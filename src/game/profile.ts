import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as zlib from "zlib";

const MARKER_FILE = ".evalatro-profile";

export interface PreparedProfile {
  restore: () => void;
}

function saveRoot(): string {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Balatro");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Balatro");
  }
  return path.join(
    os.homedir(),
    ".local",
    "share",
    "Steam",
    "steamapps",
    "compatdata",
    "2379780",
    "pfx",
    "drive_c",
    "users",
    "steamuser",
    "AppData",
    "Roaming",
    "Balatro",
  );
}

function decodeJkr(file: string): string {
  return zlib.inflateRawSync(fs.readFileSync(file)).toString("utf8");
}

function encodeJkr(text: string): Buffer {
  return zlib.deflateRawSync(Buffer.from(text, "utf8"));
}

function setSettingsProfile(text: string, slot: number): string {
  if (/\["profile"\]\s*=\s*\d+/.test(text)) {
    return text.replace(/\["profile"\]\s*=\s*\d+/, `["profile"]=${slot}`);
  }
  return text.replace(/^return\s*\{/, `return {["profile"]=${slot},`);
}

function copyDirIfMissing(source: string, target: string): void {
  if (fs.existsSync(target)) return;
  if (!fs.existsSync(source)) {
    throw new Error(`Cannot create Evalatro profile: base Balatro profile is missing at ${source}. Launch Balatro once, then rerun.`);
  }
  fs.cpSync(source, target, { recursive: true });
}

function ensureEvalProfile(root: string, slot: number): void {
  const dir = path.join(root, String(slot));
  const marker = path.join(dir, MARKER_FILE);
  if (fs.existsSync(dir) && !fs.existsSync(marker)) {
    throw new Error(
      `Balatro profile slot ${slot} already exists and is not managed by Evalatro. ` +
      "Set evalProfileSlot to a free slot (2 or 3), or set it to 0 to disable profile switching.",
    );
  }

  copyDirIfMissing(path.join(root, "1"), dir);
  fs.writeFileSync(marker, "Dedicated Evalatro benchmark profile. Safe to delete when Evalatro is uninstalled.\n");

  const profilePath = path.join(dir, "profile.jkr");
  if (fs.existsSync(profilePath)) {
    const text = decodeJkr(profilePath);
    const withUnlock = /\["all_unlocked"\]\s*=/.test(text)
      ? text.replace(/\["all_unlocked"\]\s*=\s*(?:true|false)/, '["all_unlocked"]=true')
      : text.replace(/^return\s*\{/, 'return {["all_unlocked"]=true,');
    if (withUnlock !== text) fs.writeFileSync(profilePath, encodeJkr(withUnlock));
  }
}

export function prepareEvalProfile(slot: number): PreparedProfile {
  if (!slot) return { restore: () => {} };
  const root = saveRoot();
  const settingsPath = path.join(root, "settings.jkr");
  if (!fs.existsSync(settingsPath)) {
    throw new Error(`Cannot switch Balatro profile: settings.jkr is missing at ${settingsPath}. Launch Balatro once, then rerun.`);
  }

  ensureEvalProfile(root, slot);

  const originalSettings = fs.readFileSync(settingsPath);
  const settingsText = decodeJkr(settingsPath);
  fs.writeFileSync(settingsPath, encodeJkr(setSettingsProfile(settingsText, slot)));

  let restored = false;
  return {
    restore: () => {
      if (restored) return;
      restored = true;
      try { fs.writeFileSync(settingsPath, originalSettings); } catch { /* best effort */ }
    },
  };
}

