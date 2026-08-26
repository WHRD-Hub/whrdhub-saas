import { cookies } from "next/headers";
import { SUPPORTED, type Language } from "./translations";

const LANG_COOKIE = "whrd-lang";

function isSupported(value: string | null | undefined): value is Language {
  return !!value && (SUPPORTED as string[]).includes(value);
}

/**
 * Resolves the language a server component should render in.
 * Priority: whrd-lang cookie -> DB profile preference -> "en".
 *
 * The cookie is checked first because it reflects the most recent explicit
 * choice on THIS device and is written synchronously by setLanguage(), so a
 * router.refresh() after a switch re-renders in the new language immediately
 * (without waiting on the async DB write). The DB preference is the
 * cross-device fallback used on a fresh device that has no cookie yet.
 */
export async function getServerLanguage(preferred?: string | null): Promise<Language> {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LANG_COOKIE)?.value;
  if (isSupported(cookieLang)) return cookieLang;

  if (isSupported(preferred)) return preferred;

  return "en";
}
