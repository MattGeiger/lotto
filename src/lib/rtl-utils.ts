export const RTL_LANGUAGES = ["ar", "fa"] as const;
export type RTLLanguage = (typeof RTL_LANGUAGES)[number];

export function isRTL(language: string): boolean {
  return RTL_LANGUAGES.includes(language as RTLLanguage);
}
