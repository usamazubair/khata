import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";

import ModulesScreen from "./screens/ModulesScreen";
import HomeScreen from "./screens/HomeScreen";
import AddScreen from "./screens/AddScreen";
import ManualEntryScreen from "./screens/ManualEntryScreen";
import FixedDueScreen from "./screens/FixedDueScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import InsightsScreen from "./screens/InsightsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import WorkoutHomeScreen from "./screens/WorkoutHomeScreen";
import WorkoutSessionsScreen from "./screens/WorkoutSessionsScreen";
import WorkoutSessionScreen from "./screens/WorkoutSessionScreen";
import WorkoutExercisesScreen from "./screens/WorkoutExercisesScreen";
import WorkoutExerciseScreen from "./screens/WorkoutExerciseScreen";
import TimetableScreen from "./screens/TimetableScreen";
import TimetableEntryScreen from "./screens/TimetableEntryScreen";
import TodoListsScreen from "./screens/TodoListsScreen";
import TodoListScreen from "./screens/TodoListScreen";
import SmsReviewScreen from "./screens/SmsReviewScreen";
import NotificationsScreen from "./screens/NotificationsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TRANSACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Entries: "list-outline",
  Add: "add-circle",
  Insights: "stats-chart-outline",
  Settings: "settings-outline",
};

const TIMETABLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Agenda: "calendar-outline",
  Settings: "settings-outline",
};

const TODO_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Lists: "albums-outline",
  Settings: "settings-outline",
};

const WORKOUT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "This week": "flame-outline",
  Sessions: "barbell-outline",
  Exercises: "list-outline",
  Settings: "settings-outline",
};

function tabScreenOptions(t: ReturnType<typeof useTheme>, icons: Record<string, keyof typeof Ionicons.glyphMap>) {
  return ({ route }: any) => ({
    headerShown: false,
    tabBarActiveTintColor: t.accent,
    tabBarInactiveTintColor: t.inkMuted,
    tabBarStyle: { backgroundColor: t.page2, borderTopColor: t.rule },
    tabBarIcon: ({ color, size }: any) => (
      <Ionicons name={icons[route.name] ?? "ellipse-outline"} size={size} color={color} />
    ),
  });
}

function TransactionsTabs() {
  const t = useTheme();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(t, TRANSACTION_ICONS)}>
      <Tab.Screen name="Home" component={HomeScreen} />
      {/* Named "Entries" rather than "Transactions" -- the outer Stack.Screen
          for this whole module is already called "Transactions", and React
          Navigation warns (rightly) about two same-named screens nested
          inside one another. tabBarLabel keeps what the user actually sees
          unchanged. */}
      <Tab.Screen name="Entries" component={TransactionsScreen} options={{ tabBarLabel: "Transactions" }} />
      <Tab.Screen name="Add" component={AddScreen} options={{ tabBarLabel: "Add" }} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function WorkoutTabs() {
  const t = useTheme();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(t, WORKOUT_ICONS)}>
      <Tab.Screen name="This week" component={WorkoutHomeScreen} />
      <Tab.Screen name="Sessions" component={WorkoutSessionsScreen} />
      <Tab.Screen name="Exercises" component={WorkoutExercisesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function TimetableTabs() {
  const t = useTheme();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(t, TIMETABLE_ICONS)}>
      <Tab.Screen name="Agenda" component={TimetableScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function TodoTabs() {
  const t = useTheme();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(t, TODO_ICONS)}>
      <Tab.Screen name="Lists" component={TodoListsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const t = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.paper },
        headerTintColor: t.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.paper },
      }}
    >
      <Stack.Screen name="Modules" component={ModulesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Transactions" component={TransactionsTabs} options={{ title: "Transactions" }} />
      <Stack.Screen name="Workout" component={WorkoutTabs} options={{ title: "Workout" }} />
      <Stack.Screen name="Timetable" component={TimetableTabs} options={{ title: "Timetable" }} />
      <Stack.Screen
        name="TimetableEntry"
        component={TimetableEntryScreen}
        options={({ route }: any) => ({
          title: route.params?.mode === "edit" ? "Edit entry" : "New entry",
          presentation: "modal",
        })}
      />
      <Stack.Screen name="Todo" component={TodoTabs} options={{ title: "Todo" }} />
      <Stack.Screen
        name="TodoList"
        component={TodoListScreen}
        options={({ route }: any) => ({ title: route.params?.name ?? "Tasks" })}
      />
      <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} options={{ title: "Workout" }} />
      <Stack.Screen name="SmsReview" component={SmsReviewScreen} options={{ title: "Log from SMS" }} />
      <Stack.Screen name="FixedDue" component={FixedDueScreen} options={{ title: "Fixed bill" }} />
      <Stack.Screen
        name="ManualEntry"
        component={ManualEntryScreen}
        options={({ route }: any) => ({
          title:
            route.params?.categoryType === "saved" ? "Saved" : route.params?.categoryType === "budget" ? "Budget" : "Expense",
        })}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen
        name="WorkoutExercise"
        component={WorkoutExerciseScreen}
        options={({ route }: any) => ({ title: route.params?.name ?? "Exercise" })}
      />
    </Stack.Navigator>
  );
}
