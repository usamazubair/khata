import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";

import HomeScreen from "./screens/HomeScreen";
import AddScreen from "./screens/AddScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import InsightsScreen from "./screens/InsightsScreen";
import SettingsScreen from "./screens/SettingsScreen";

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Transactions: "list-outline",
  Add: "add-circle",
  Insights: "stats-chart-outline",
  Settings: "settings-outline",
};

export default function RootNavigator() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.inkMuted,
        tabBarStyle: { backgroundColor: t.page2, borderTopColor: t.rule },
        tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Add" component={AddScreen} options={{ tabBarLabel: "Add" }} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
