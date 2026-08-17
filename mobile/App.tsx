import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/Navigation";
import LoginScreen from "./src/screens/LoginScreen";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { useTheme } from "./src/theme";

function Root() {
  const t = useTheme();
  const { ready, user } = useAuth();

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

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.paper }}>
        <ActivityIndicator color={t.accent} />
        <StatusBar style={t.isDark ? "light" : "dark"} />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <StatusBar style={t.isDark ? "light" : "dark"} />
      </>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
      <StatusBar style={t.isDark ? "light" : "dark"} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
