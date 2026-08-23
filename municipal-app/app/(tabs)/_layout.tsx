import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index:         { active: "home",        inactive: "home-outline" },
  agenda:        { active: "calendar",    inactive: "calendar-outline" },
  ayuntamiento:  { active: "business",    inactive: "business-outline" },
  mapa:          { active: "map",         inactive: "map-outline" },
  perfil:        { active: "person",      inactive: "person-outline" },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: Colors.tabBar.active,
        tabBarInactiveTintColor: Colors.tabBar.inactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBar.background,
          borderTopColor: Colors.tabBar.border,
          borderTopWidth: 0.5,
          height: 82,
          paddingBottom: 26,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_500Medium",
          letterSpacing: 0.1,
        },
        tabBarIcon: ({ color, focused }) => {
          const icons = TAB_ICONS[route.name] ?? { active: "ellipse", inactive: "ellipse-outline" };
          return <Ionicons name={focused ? icons.active : icons.inactive} size={24} color={color} />;
        },
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontFamily: "Inter_700Bold", fontSize: 17, letterSpacing: -0.3 },
        headerShadowVisible: false,
      })}
    >
      <Tabs.Screen name="index"        options={{ title: "Inicio",       headerTitle: "Mi Pueblo" }} />
      <Tabs.Screen name="agenda"       options={{ title: "Agenda" }} />
      <Tabs.Screen name="ayuntamiento" options={{ title: "Ayuntamiento" }} />
      <Tabs.Screen name="mapa"         options={{ title: "Mapa" }} />
      <Tabs.Screen name="perfil"       options={{ title: "Perfil" }} />
      <Tabs.Screen name="tramites"     options={{ href: null }} />
      <Tabs.Screen name="incidencias"  options={{ href: null }} />
      <Tabs.Screen name="eventos"      options={{ href: null }} />
    </Tabs>
  );
}
