import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";

import ModulesScreen from "./screens/ModulesScreen";
import SectionsScreen from "./screens/SectionsScreen";
import RecordsScreen from "./screens/RecordsScreen";
import HomeScreen from "./screens/HomeScreen";
import AddScreen from "./screens/AddScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import InsightsScreen from "./screens/InsightsScreen";
import SettingsScreen from "./screens/SettingsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Transactions: "list-outline",
  Add: "add-circle",
  Insights: "stats-chart-outline",
  Settings: "settings-outline",
};

function KhataTabs() {
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
      <Stack.Screen name="Khata" component={KhataTabs} options={{ title: "Khata" }} />
      <Stack.Screen
        name="Sections"
        component={SectionsScreen}
        options={({ route }: any) => ({ title: route.params?.name || "Module" })}
      />
      <Stack.Screen
        name="Records"
        component={RecordsScreen}
        options={({ route }: any) => ({ title: route.params?.section?.name || "Records" })}
      />
    </Stack.Navigator>
  );
}
