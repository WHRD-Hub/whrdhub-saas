/**
 * Turn a user-agent string into something a person recognises.
 *
 * The point of the device list is that a woman can look at it and say "that
 * one is not mine". "Chrome on Android" lets her do that; the raw string does
 * not. So this is deliberately coarse — browser and platform, nothing more.
 *
 * User agents lie, and every attempt at precision here ages badly, so the
 * order of the checks matters more than their number: Edge and Opera both
 * claim to be Chrome, Chrome claims to be Safari, and every one of them claims
 * to be Mozilla. The specific names are therefore tested before the general.
 */

export interface DeviceLabel {
  browser: string;
  platform: string;
  /** Roughly what it is, for choosing an icon. */
  kind: "phone" | "tablet" | "desktop" | "unknown";
}

export function describeDevice(ua: string | null | undefined): DeviceLabel {
  if (!ua) return { browser: "Unknown browser", platform: "Unknown device", kind: "unknown" };

  const browser =
    /\bEdgA?\//.test(ua) ? "Edge"
    : /\bOPR\/|\bOpera/.test(ua) ? "Opera"
    : /\bSamsungBrowser\//.test(ua) ? "Samsung Internet"
    : /\bFirefox\/|\bFxiOS\//.test(ua) ? "Firefox"
    : /\bChrome\/|\bCriOS\//.test(ua) ? "Chrome"
    : /\bSafari\//.test(ua) ? "Safari"
    : "Browser";

  const platform =
    /\bAndroid\b/.test(ua) ? "Android"
    : /\biPhone\b/.test(ua) ? "iPhone"
    : /\biPad\b/.test(ua) ? "iPad"
    : /\bWindows NT\b/.test(ua) ? "Windows"
    : /\bMac OS X\b|\bMacintosh\b/.test(ua) ? "Mac"
    : /\bCrOS\b/.test(ua) ? "ChromeOS"
    : /\bLinux\b/.test(ua) ? "Linux"
    : "Unknown device";

  const kind: DeviceLabel["kind"] =
    /\biPad\b|\bTablet\b/.test(ua) ? "tablet"
    : /\bMobile\b|\biPhone\b|\bAndroid\b/.test(ua) ? "phone"
    : platform === "Unknown device" ? "unknown"
    : "desktop";

  return { browser, platform, kind };
}

/** "Chrome on Android", or just the platform when the browser is a guess. */
export function deviceName(ua: string | null | undefined): string {
  const { browser, platform } = describeDevice(ua);
  if (browser === "Browser" && platform === "Unknown device") return "Unrecognised device";
  if (browser === "Browser") return platform;
  return `${browser} on ${platform}`;
}
