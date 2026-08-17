import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/Navigation";
import { useTheme } from "./src/theme";

export default function App() {
  const t = useTheme();
  const navTheme = {
    ...(t.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: t.paper,
      card: t.page2,
      text: t.ink,
      border: t.rule,
      primary: t.accent,
    },
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
        <StatusBar style={t.isDark ? "light" : "dark"} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
