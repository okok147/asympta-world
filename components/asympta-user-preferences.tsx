"use client";

import { useLayoutEffect } from "react";

import {
  hasStoredAsymptaUserPreferences,
  readAsymptaUserPreferences,
  subscribeAsymptaUserPreferences,
  writeAsymptaUserPreferences,
  type AsymptaLocale,
  type AsymptaUserPreferences,
} from "@/lib/asympta-user-preferences";

const LANGUAGE_SELECTOR = ".atlas-language-menu";
const LANGUAGE_BUTTON_SELECTOR = ".atlas-language-menu button";
const LANGUAGE_ORDER: AsymptaLocale[] = ["en", "zh-Hant", "ja"];

function localeFromDocument(): AsymptaLocale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function languageButtons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(LANGUAGE_BUTTON_SELECTOR));
}

function activeLocaleFromMenu(): AsymptaLocale | null {
  const buttons = languageButtons();
  const index = buttons.findIndex((button) => button.classList.contains("is-active"));
  return LANGUAGE_ORDER[index] ?? null;
}

function applyLocale(locale: AsymptaLocale) {
  document.documentElement.lang = locale;
  const buttons = languageButtons();
  const index = LANGUAGE_ORDER.indexOf(locale);
  const button = buttons[index];
  if (!button || button.classList.contains("is-active")) return Boolean(button);

  // The World component owns locale React state. Clicking its hidden language
  // option keeps that state, every translated surface, and <html lang> aligned.
  button.click();
  return true;
}

export function AsymptaUserPreferences() {
  useLayoutEffect(() => {
    let disposed = false;
    let retryFrame = 0;
    let applyingPreference = false;
    let preferredLocale: AsymptaLocale;

    if (!hasStoredAsymptaUserPreferences()) {
      writeAsymptaUserPreferences({ locale: localeFromDocument() });
    }

    preferredLocale = readAsymptaUserPreferences().locale;

    const restore = (preferences: AsymptaUserPreferences, attempts = 0) => {
      if (disposed) return;
      preferredLocale = preferences.locale;
      applyingPreference = true;
      const applied = applyLocale(preferences.locale);
      applyingPreference = false;

      if (!applied && attempts < 8) {
        retryFrame = window.requestAnimationFrame(() => restore(preferences, attempts + 1));
      }
    };

    restore(readAsymptaUserPreferences());

    const menu = document.querySelector<HTMLElement>(LANGUAGE_SELECTOR);
    const menuObserver = menu
      ? new MutationObserver(() => {
          if (applyingPreference) return;
          const locale = activeLocaleFromMenu();
          if (!locale) return;
          preferredLocale = locale;
          document.documentElement.lang = locale;
          const stored = readAsymptaUserPreferences();
          if (stored.locale !== locale) writeAsymptaUserPreferences({ locale });
        })
      : null;

    menuObserver?.observe(menu as HTMLElement, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });

    // The main World component also writes <html lang> from its own React effect.
    // Enforce the saved locale if that older effect briefly writes its default
    // during hydration, so translated UI never visibly flashes back to English.
    const documentObserver = new MutationObserver(() => {
      if (applyingPreference || localeFromDocument() === preferredLocale) return;
      restore({ ...readAsymptaUserPreferences(), locale: preferredLocale });
    });
    documentObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    const unsubscribe = subscribeAsymptaUserPreferences((preferences) => {
      preferredLocale = preferences.locale;
      if (preferences.locale === activeLocaleFromMenu() && localeFromDocument() === preferences.locale) return;
      restore(preferences);
    });

    return () => {
      disposed = true;
      if (retryFrame) window.cancelAnimationFrame(retryFrame);
      menuObserver?.disconnect();
      documentObserver.disconnect();
      unsubscribe();
    };
  }, []);

  return null;
}
