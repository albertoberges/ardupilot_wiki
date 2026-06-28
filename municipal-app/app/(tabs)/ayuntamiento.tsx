import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { Colors } from "@/constants/colors";

function Fila({ icon, titulo, descripcion, onPress, color }: {
  icon: string; titulo: string; descripcion: string; onPress: () => void; color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
      activeOpacity={0.7}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (color ?? Colors.primary) + "15", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
        <Ionicons name={icon as any} size={22} color={color ?? Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827" }}>{titulo}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2, fontFamily: "Inter_400Regular" }}>{descripcion}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6b7280", marginBottom: 10, marginTop: 16, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {text}
    </Text>
  );
}

export default function AyuntamientoScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const esAdmin = profile?.role === "admin" || profile?.role === "ayuntamiento";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Ionicons name="business" size={28} color="#fff" style={{ marginRight: 10 }} />
          <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" }}>Ayuntamiento</Text>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" }}>
          Servicios, trámites e información municipal
        </Text>
      </View>

      <View style={{ padding: 16, marginTop: -16 }}>
        {/* Panel de gestión — solo admin/ayuntamiento */}
        {esAdmin && (
          <>
            <Label text="Panel de gestión" />
            <Fila
              icon="newspaper"
              titulo="Publicar noticia"
              descripcion="Crear una nueva noticia o aviso"
              onPress={() => router.push("/noticia/nueva" as any)}
              color="#2980b9"
            />
            <Fila
              icon="calendar"
              titulo="Crear evento"
              descripcion="Añadir un evento a la agenda"
              onPress={() => router.push("/(tabs)/agenda" as any)}
              color="#8e44ad"
            />
            <Fila
              icon="warning"
              titulo="Ver incidencias"
              descripcion="Gestionar incidencias pendientes"
              onPress={() => router.push("/(tabs)/incidencias" as any)}
              color="#e67e22"
            />
          </>
        )}

        <Label text="Servicios" />
        <Fila
          icon="document-text-outline"
          titulo="Trámites"
          descripcion="Gestiones y solicitudes municipales"
          onPress={() => router.push("/(tabs)/tramites" as any)}
        />
        <Fila
          icon="warning-outline"
          titulo="Incidencias"
          descripcion="Reporta problemas en el municipio"
          onPress={() => router.push("/(tabs)/incidencias" as any)}
        />

        <Label text="Contacto" />
        <Fila icon="call-outline" titulo="Teléfono" descripcion="Llama al ayuntamiento" onPress={() => Linking.openURL("tel:+34976680900")} />
        <Fila icon="mail-outline" titulo="Email" descripcion="Envía un correo al ayuntamiento" onPress={() => Linking.openURL("mailto:ayuntamiento@villamayordegallego.es")} />
        <Fila icon="globe-outline" titulo="Sede electrónica" descripcion="Portal web del ayuntamiento" onPress={() => Linking.openURL("https://villamayordegallego.es")} />

        <Label text="Horario de atención" />
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
          {[
            { dias: "Lunes - Viernes", hora: "9:00 - 14:00" },
            { dias: "Tardes (L, X)", hora: "16:00 - 19:00" },
            { dias: "Sábados y festivos", hora: "Cerrado", rojo: true },
          ].map(({ dias, hora, rojo }, i, arr) => (
            <View key={dias}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
                <Text style={{ color: "#374151", fontFamily: "Inter_500Medium" }}>{dias}</Text>
                <Text style={{ color: rojo ? "#ef4444" : "#6b7280", fontFamily: "Inter_400Regular" }}>{hora}</Text>
              </View>
              {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: "#f3f4f6" }} />}
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}
