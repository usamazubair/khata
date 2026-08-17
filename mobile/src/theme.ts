import { Platform, useColorScheme } from "react-native";

const light = {
  paper: "#F2ECDD",
  page: "#FBF8F0",
  page2: "#E8DFC7",
  rule: "#D6C9A8",
  ink: "#241C15",
  inkMuted: "#6E6250",
  accent: "#7A2331",
  accentInk: "#FBF8F0",
  accent2: "#C79A44",
};

const dark = {
  paper: "#1C1712",
  page: "#241D16",
  page2: "#2E251A",
  rule: "#3A2F22",
  ink: "#EDE6D6",
  inkMuted: "#A89A82",
  accent: "#E08A99",
  accentInk: "#241D16",
  accent2: "#D9A752",
};

const status = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

// Light-mode categorical hex (as stored in the DB) -> its dark-mode step.
export const CATEGORY_DARK_STEP: Record<string, string> = {
  "#2a78d6": "#3987e5",
  "#eb6834": "#d95926",
  "#1baf7a": "#199e70",
  "#eda100": "#c98500",
  "#e87ba4": "#d55181",
  "#008300": "#008300",
  "#4a3aa7": "#9085e9",
  "#e34948": "#e66767",
};

export function useTheme() {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? dark : light;
  return {
    ...c,
    status,
    isDark: scheme === "dark",
    categoryColor: (hex: string) => (scheme === "dark" ? CATEGORY_DARK_STEP[hex] || hex : hex),
  };
}

export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
};
