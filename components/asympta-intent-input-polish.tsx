"use client";

import { useEffect } from "react";

const FORM_SELECTOR = ".asympta-intent-composer";
const MIN_HEIGHT_PX = 46;
const MAX_HEIGHT_PX = 144;
const ATTACH_RETRY_MS = 100;
const MAX_ATTACH_ATTEMPTS = 40;
const VALUE_SYNC_MS = 180;

function finitePixels(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function fitTextarea(textarea: HTMLTextAreaElement) {
  const cssMaxHeight = finitePixels(window.getComputedStyle(textarea).maxHeight) ?? MAX_HEIGHT_PX;
  const viewportMaxHeight = Math.round(window.innerHeight * 0.34);
  const maxHeight = Math.max(
    MIN_HEIGHT_PX,
    Math.min(MAX_HEIGHT_PX, cssMaxHeight, viewportMaxHeight),
  );

  textarea.style.height = "auto";
  const naturalHeight = Math.max(MIN_HEIGHT_PX, textarea.scrollHeight);
  const nextHeight = Math.min(naturalHeight, maxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = naturalHeight > maxHeight ? "auto" : "hidden";
}

export function AsymptaIntentInputPolish() {
  useEffect(() => {
    let attachTimer = 0;
    let detach = () => {};
    let attempts = 0;

    const attach = () => {
      const form = document.querySelector<HTMLFormElement>(FORM_SELECTOR);
      const textarea = form?.querySelector<HTMLTextAreaElement>("textarea") ?? null;
      if (!form || !textarea) return false;

      form.dataset.asymptaInputPolished = "true";
      textarea.dataset.asymptaPrimaryInput = "true";
      textarea.setAttribute("enterkeyhint", "send");
      textarea.setAttribute("autocapitalize", "sentences");
      textarea.setAttribute("autocomplete", "off");
      textarea.setAttribute("aria-multiline", "true");

      let animationFrame = 0;
      let lastValue = textarea.value;
      let lastWidth = textarea.clientWidth;

      const scheduleFit = () => {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(() => {
          fitTextarea(textarea);
          lastValue = textarea.value;
          lastWidth = textarea.clientWidth;
        });
      };

      const focusPrimaryInput = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const target = event.target;
        if (target instanceof Element && target.closest("textarea, button")) return;
        window.requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
      };

      const preserveImeComposition = (event: KeyboardEvent) => {
        if (event.key === "Enter" && (event.isComposing || event.keyCode === 229)) {
          event.stopImmediatePropagation();
        }
      };

      const syncTimer = window.setInterval(() => {
        if (textarea.value !== lastValue || textarea.clientWidth !== lastWidth) scheduleFit();
      }, VALUE_SYNC_MS);

      textarea.addEventListener("input", scheduleFit);
      textarea.addEventListener("change", scheduleFit);
      textarea.addEventListener("keydown", preserveImeComposition, { capture: true });
      form.addEventListener("pointerdown", focusPrimaryInput);
      form.addEventListener("submit", scheduleFit);
      window.addEventListener("resize", scheduleFit, { passive: true });
      window.visualViewport?.addEventListener("resize", scheduleFit, { passive: true });
      scheduleFit();

      detach = () => {
        window.clearInterval(syncTimer);
        window.cancelAnimationFrame(animationFrame);
        textarea.removeEventListener("input", scheduleFit);
        textarea.removeEventListener("change", scheduleFit);
        textarea.removeEventListener("keydown", preserveImeComposition, { capture: true });
        form.removeEventListener("pointerdown", focusPrimaryInput);
        form.removeEventListener("submit", scheduleFit);
        window.removeEventListener("resize", scheduleFit);
        window.visualViewport?.removeEventListener("resize", scheduleFit);
        delete form.dataset.asymptaInputPolished;
        delete textarea.dataset.asymptaPrimaryInput;
      };

      return true;
    };

    if (!attach()) {
      attachTimer = window.setInterval(() => {
        attempts += 1;
        if (attach() || attempts >= MAX_ATTACH_ATTEMPTS) window.clearInterval(attachTimer);
      }, ATTACH_RETRY_MS);
    }

    return () => {
      window.clearInterval(attachTimer);
      detach();
    };
  }, []);

  return null;
}
