import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useNoticias } from "@/hooks/useNoticias";
import { NoticiaCard } from "@/components/NoticiaCard";
import { Colors } from "@/constants/colors";

export default function HomeScreen() {
  const router = useRouter();
  const { noticias, loading, refreshing, refresh } = useNoticias();

  const destacadas = noticias.filter((n) => n.destacada).slice(0, 2);
  const resto = noticias.filter((n) => !n.destacada).slice(0, 10);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f8f9fa" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      {/* Accesos rápidos */}
      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push("/mercado" as any)}
            style={{
              flex: 1,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 16,
              padding: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
            }}
          >
            <Ionicons name="storefront" size={32} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 8 }}>
              Mercado
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2, textAlign: "center" }}>
              Compra y vende en el pueblo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/empresas" as any)}
            style={{
              flex: 1,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 16,
              padding: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
            }}
          >
            <Ionicons name="briefcase" size={32} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 8 }}>
              Empresas
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2, textAlign: "center" }}>
              Negocios y servicios locales
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        {/* Urgentes */}
        {noticias.filter((n) => n.categoria === "urgente").length > 0 && (
          <View style={{
            marginHorizontal: 16,
            marginBottom: 12,
            backgroundColor: "#fff5f5",
            borderWidth: 1,
            borderColor: "#fed7d7",
            borderRadius: 12,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}>
            <Ionicons name="alert-circle" size={20} color={Colors.danger} />
            <Text style={{ color: "#c53030", fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={2}>
              {noticias.find((n) => n.categoria === "urgente")?.titulo}
            </Text>
          </View>
        )}

        {/* Noticias destacadas */}
        {destacadas.length > 0 && (
          <>
            <Text style={{ color: "#1a202c", fontFamily: "Inter_700Bold", fontSize: 16, paddingHorizontal: 16, marginBottom: 10 }}>
              Destacado
            </Text>
            {destacadas.map((n) => (
              <NoticiaCard key={n.id} noticia={n} destacada />
            ))}
          </>
        )}

        {/* Últimas noticias */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10, marginTop: 8 }}>
          <Text style={{ color: "#1a202c", fontFamily: "Inter_700Bold", fontSize: 16 }}>Últimas noticias</Text>
        </View>

        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <View key={i} style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 12, backgroundColor: "#e2e8f0", height: 96 }} />
            ))
          : resto.map((n) => <NoticiaCard key={n.id} noticia={n} />)}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
