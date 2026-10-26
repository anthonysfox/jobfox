"use client";

import { useEffect } from "react";

/**
 * Keyboard shortcuts for the label page: each key clicks the button with the
 * matching data-key, so the server-action forms stay the single code path.
 */
export function LabelKeys() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea, input") || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const button = document.querySelector<HTMLElement>(`[data-key="${event.key.toLowerCase()}"]`);
      if (button) {
        event.preventDefault();
        button.click();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  return null;
}
