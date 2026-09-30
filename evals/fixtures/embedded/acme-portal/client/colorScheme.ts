import { useSyncExternalStore } from "react";

export type ColorScheme = "light" | "dark";

const storageKey = "acme-color-scheme";
const listeners = new Set<() => void>();

const initialScheme = (): ColorScheme => {
  const stored = localStorage.getItem(storageKey);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

let current: ColorScheme = initialScheme();
document.documentElement.dataset.theme = current;

export const getColorScheme = () => current;

export const setColorScheme = (scheme: ColorScheme) => {
  current = scheme;
  document.documentElement.dataset.theme = scheme;
  localStorage.setItem(storageKey, scheme);
  for (const listener of listeners) listener();
};

export const subscribeToColorScheme = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useColorScheme = () =>
  useSyncExternalStore(subscribeToColorScheme, getColorScheme);
