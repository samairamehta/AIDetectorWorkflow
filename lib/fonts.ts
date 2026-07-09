// UI font options. `value` is a CSS font-family the app applies to --font-ui,
// which the Tailwind `font-sans` utility (and the body) resolves through.

export interface FontOption {
  id: string;
  label: string;
  value: string;
  kind: "sans" | "serif";
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "inter", label: "Inter", value: "var(--font-inter)", kind: "sans" },
  { id: "grotesk", label: "Space Grotesk", value: "var(--font-grotesk)", kind: "sans" },
  { id: "newsreader", label: "Newsreader", value: "var(--font-newsreader)", kind: "serif" },
  { id: "lora", label: "Lora", value: "var(--font-lora)", kind: "serif" },
  { id: "system", label: "System", value: "ui-sans-serif, system-ui, sans-serif", kind: "sans" },
];

export const DEFAULT_FONT = "inter";

export function fontValue(id: string): string {
  return (FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0]).value;
}
