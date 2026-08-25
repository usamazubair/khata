import { useEffect, useRef } from "react";
import { AppState, View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/Navigation";
import LoginScreen from "./src/screens/LoginScreen";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { useTheme } from "./src/theme";
import { configureNotificationHandler, refreshReminders } from "./src/lib/reminders";
import { logReceived } from "./src/lib/notificationLog";
import { navigationRef, navigateFromNotificationData, flushPendingNavigation } from "./src/navigationRef";

configureNotificationHandler();

// Tapping a reminder notification should land you on the screen it's
// about, not just open the app to wherever it last was. Registered once,
// outside the component tree, so it also catches the response that
// cold-started the app (a tap while it wasn't running at all).
Notifications.addNotificationResponseReceivedListener((response) => {
  navigateFromNotificationData(response.notification.request.content.data as Record<string, unknown>);
});
Notifications.getLastNotificationResponseAsync().then((response) => {
  if (response) navigateFromNotificationData(response.notification.request.content.data as Record<string, unknown>);
});

// Keeps a local history for the notification bell. Only catches deliveries
// that happen while this JS is alive to see them — a notification fired
// while the app is fully closed reaches the system tray same as ever, it
// just never passes through this listener.
Notifications.addNotificationReceivedListener((notification) => {
  const { title, body } = notification.request.content;
  logReceived(title ?? "Notification", body ?? "");
});

function Root() {
  const t = useTheme();
  const { ready, user } = useAuth();
  const appState = useRef(AppState.currentState);

  // Rebuild the reminder schedule on sign-in and whenever the app returns to
  // the foreground, so "already trained today" and "this bill is still open"
  // stay accurate. Timetable entries and bills are edited on the web
  // dashboard, though, not on the phone — if the app is just left sitting
  // open the whole time, neither of those triggers ever fires again, so a
  // periodic refresh underneath catches anything changed elsewhere.
  useEffect(() => {
    if (!user) return;
    refreshReminders();
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") refreshReminders();
      appState.current = next;
    });
    const interval = setInterval(refreshReminders, 15 * 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [user]);

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
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={flushPendingNavigation}>
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
