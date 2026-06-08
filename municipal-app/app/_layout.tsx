import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#1a5276" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
          contentStyle: { backgroundColor: "#f8f9fa" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="noticia/[id]" options={{ title: "Noticia" }} />
        <Stack.Screen name="evento/[id]" options={{ title: "Evento" }} />
        <Stack.Screen name="incidencia/[id]" options={{ title: "Incidencia" }} />
        <Stack.Screen name="incidencia/nueva" options={{ title: "Nueva Incidencia", presentation: "modal" }} />
        <Stack.Screen name="+not-found" options={{ title: "No encontrado" }} />
      </Stack>
    </>
  );
}
