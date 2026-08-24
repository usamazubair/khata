import { Platform, useColorScheme } from "react-native";

/* Same direction as the dashboard: a cool steel ground carrying saturated
   blue / violet / blaze-orange accents. Kept flat here — React Native has no
   CSS gradients without another dependency, and solid steps read cleanly on a
   phone anyway. */
const light = {
  paper: "#EAEEFA",
  page: "#FFFFFF",
  page2: "#E2E8F6",
  rule: "#CDD7EC",
  ink: "#0C1526",
  inkMuted: "#56688A",
  accent: "#2F4BFF",
  accentInk: "#FFFFFF",
  accent2: "#FF6A2B",
  accent3: "#7B3FF2",
};

const dark = {
  paper: "#070A12",
  page: "#101725",
  page2: "#192234",
  rule: "#26314A",
  ink: "#E9EEFB",
  inkMuted: "#93A2C0",
  accent: "#5B7CFF",
  accentInk: "#060A14",
  accent2: "#FF824A",
  accent3: "#9A6BFF",
};

const statusLight = {
  good: "#00996B",
  warning: "#E08700",
  serious: "#F4661F",
  critical: "#E03551",
};

const statusDark = {
  good: "#21C98E",
  warning: "#FFB32E",
  serious: "#FF8043",
  critical: "#FF5C72",
};

// Stored category hex -> its dark-mode step. Both the current swatches and the
// ones earlier categories were saved with are listed, so older rows keep
// adapting instead of falling back to a colour tuned for a light ground.
export const CATEGORY_DARK_STEP: Record<string, string> = {
  // current palette
  "#2f6bff": "#5b86ff",
  "#f4661f": "#ff8043",
  "#00b37e": "#16c791",
  "#f0a500": "#ffb92e",
  "#e0459c": "#ef62ae",
  "#12b0c9": "#2ecbe3",
  "#7b3ff2": "#9a6bff",
  "#e33b4e": "#ff5c6e",
  // retired palette, still present on existing categories
  "#2a78d6": "#5b86ff",
  "#eb6834": "#ff8043",
  "#1baf7a": "#16c791",
  "#eda100": "#ffb92e",
  "#e87ba4": "#ef62ae",
  "#008300": "#16c791",
  "#4a3aa7": "#9a6bff",
  "#e34948": "#ff5c6e",
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const c = isDark ? dark : light;
  return {
    ...c,
    status: isDark ? statusDark : statusLight,
    isDark,
    categoryColor: (hex: string) => (isDark ? CATEGORY_DARK_STEP[hex] || hex : hex),
  };
}

export const fonts = {
  display: Platform.select({ ios: "Avenir Next", android: "sans-serif-condensed", default: "System" }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
};
