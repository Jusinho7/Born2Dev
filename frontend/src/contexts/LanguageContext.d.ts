import type { ReactElement, ReactNode } from "react";

export type LanguageCode = "mg" | "fr" | "en";

export function LanguageProvider(props: { children: ReactNode }): ReactElement;
export function Localized(props: { children: ReactNode }): ReactElement;
export function useLanguage(): {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
};
