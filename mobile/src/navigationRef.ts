import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

/** Where a notification's `data.screen` points. Shared by every local
 *  notification the app schedules (workout/bill/timetable reminders, and
 *  now a detected SMS transaction), so tapping one actually lands you on
 *  the right screen instead of just opening the app. */
const SCREEN_ROUTES: Record<string, string> = {
  workout: "Workout",
  transactions: "Transactions",
  timetable: "Timetable",
  todo: "Todo",
  smsReview: "SmsReview",
};

// A notification that cold-starts the app arrives before the navigator has
// mounted — `navigationRef.isReady()` is false at that point, so the target
// is held here and flushed once `NavigationContainer`'s onReady fires,
// rather than the tap silently doing nothing.
let pendingScreen: string | null = null;

export function navigateFromNotificationData(data: Record<string, unknown> | undefined) {
  const screen = typeof data?.screen === "string" ? SCREEN_ROUTES[data.screen] : undefined;
  if (!screen) return;
  if (navigationRef.isReady()) navigationRef.navigate(screen as never);
  else pendingScreen = screen;
}

export function flushPendingNavigation() {
  if (pendingScreen && navigationRef.isReady()) {
    navigationRef.navigate(pendingScreen as never);
    pendingScreen = null;
  }
}
