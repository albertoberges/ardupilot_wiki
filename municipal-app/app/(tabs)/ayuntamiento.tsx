import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";

interface SeccionProps {
  icon: string;
  titulo: string;
  descripcion: string;
  onPress: () => void;
}

function Seccion({ icon, titulo, descripcion, onPress }: SeccionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
      activeOpacity={0.7}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: Colors.primary + "15",
        alignItems: "center", justifyContent: "center", marginRight: 14,
      }}>
        <Ionicons name={icon as any} size={22} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827" }}>{titulo}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2, fontFamily: "Inter_400Regular" }}>{descripcion}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

export default function AyuntamientoScreen() {
  const router = useRouter();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      {/* Cabecera */}
      <View style={{
        backgroundColor: Colors.primary,
        paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Ionicons name="business" size={28} color="#fff" style={{ marginRight: 10 }} />
          <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" }}>Ayuntamiento</Text>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" }}>
          Servicios, trámites e información municipal
        </Text>
      </View>

      <View style={{ padding: 16, marginTop: -16 }}>
        {/* Servicios principales */}
        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6b7280", marginBottom: 10, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Servicios
        </Text>

        <Seccion
          icon="document-text-outline"
          titulo="Trámites"
          descripcion="Gestiones y solicitudes municipales"
          onPress={() => router.push("/(tabs)/tramites")}
        />
        <Seccion
          icon="warning-outline"
          titulo="Incidencias"
          descripcion="Reporta problemas en el municipio"
          onPress={() => router.push("/(tabs)/incidencias")}
        />

        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6b7280", marginBottom: 10, marginTop: 16, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Contacto
        </Text>

        <Seccion
          icon="call-outline"
          titulo="Teléfono"
          descripcion="Llama al ayuntamiento"
          onPress={() => Linking.openURL("tel:+34000000000")}
        />
        <Seccion
          icon="mail-outline"
          titulo="Email"
          descripcion="Envía un correo al ayuntamiento"
          onPress={() => Linking.openURL("mailto:ayuntamiento@mipueblo.es")}
        />
        <Seccion
          icon="globe-outline"
          titulo="Sede electrónica"
          descripcion="Portal web del ayuntamiento"
          onPress={() => Linking.openURL("https://mipueblo.es")}
        />

        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6b7280", marginBottom: 10, marginTop: 16, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Horario de atención
        </Text>

        <View style={{
          backgroundColor: "#fff", borderRadius: 12, padding: 16,
          shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <Text style={{ color: "#374151", fontFamily: "Inter_500Medium" }}>Lunes - Viernes</Text>
            <Text style={{ color: "#6b7280", fontFamily: "Inter_400Regular" }}>9:00 - 14:00</Text>
          </View>
          <View style={{ height: 1, backgroundColor: "#f3f4f6" }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <Text style={{ color: "#374151", fontFamily: "Inter_500Medium" }}>Tardes (L, X)</Text>
            <Text style={{ color: "#6b7280", fontFamily: "Inter_400Regular" }}>16:00 - 19:00</Text>
          </View>
          <View style={{ height: 1, backgroundColor: "#f3f4f6" }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <Text style={{ color: "#374151", fontFamily: "Inter_500Medium" }}>Sábados y festivos</Text>
            <Text style={{ color: "#ef4444", fontFamily: "Inter_400Regular" }}>Cerrado</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}
