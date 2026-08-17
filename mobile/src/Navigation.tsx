import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";

import HomeScreen from "./screens/HomeScreen";
import AddScreen from "./screens/AddScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import InsightsScreen from "./screens/InsightsScreen";
import MoreScreen from "./screens/MoreScreen";
import CategoriesScreen from "./screens/CategoriesScreen";
import FixedBillsScreen from "./screens/FixedBillsScreen";
import ArchivesScreen from "./screens/ArchivesScreen";
import SettingsScreen from "./screens/SettingsScreen";

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

function MoreStackNavigator() {
  const t = useTheme();
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.paper },
        headerTintColor: t.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.paper },
      }}
    >
      <MoreStack.Screen name="MoreMenu" component={MoreScreen} options={{ headerShown: false }} />
      <MoreStack.Screen name="Categories" component={CategoriesScreen} options={{ title: "Categories" }} />
      <MoreStack.Screen name="FixedBills" component={FixedBillsScreen} options={{ title: "Fixed bills" }} />
      <MoreStack.Screen name="Archives" component={ArchivesScreen} options={{ title: "Archives" }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </MoreStack.Navigator>
  );
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Transactions: "list-outline",
  Add: "add-circle",
  Insights: "stats-chart-outline",
  More: "ellipsis-horizontal-outline",
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
      <Tab.Screen name="More" component={MoreStackNavigator} />
    </Tab.Navigator>
  );
}
