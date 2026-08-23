import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useNoticias } from "@/hooks/useNoticias";
import { useAuth } from "@/hooks/useAuth";
import { NoticiaCard } from "@/components/NoticiaCard";
import { Colors } from "@/constants/colors";

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{
      fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textLight,
      textTransform: "uppercase", letterSpacing: 0.6,
      paddingHorizontal: 20, marginTop: 28, marginBottom: 12,
    }}>
      {title}
    </Text>
  );
}

function QuickCard({ icon, label, sublabel, onPress, color }: {
  icon: string; label: string; sublabel: string; onPress: () => void; color: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1, backgroundColor: Colors.card, borderRadius: 18, padding: 18,
        shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }, elevation: 3,
      }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color + "18", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.2 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textLight, marginTop: 3, lineHeight: 16 }}>
        {sublabel}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { noticias, loading, refreshing, refresh } = useNoticias();
  const puedePublicar = ["ayuntamiento", "admin", "asociacion"].includes(profile?.role ?? "");

  const urgente = noticias.find(n => n.categoria === "urgente");
  const destacadas = noticias.filter(n => n.destacada).slice(0, 2);
  const resto = noticias.filter(n => !n.destacada).slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        {/* Accesos rápidos */}
        <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <QuickCard
              icon="storefront"
              label="Mercado"
              sublabel="Compra y vende"
              color="#FF9500"
              onPress={() => router.push("/mercado" as any)}
            />
            <QuickCard
              icon="briefcase"
              label="Empresas"
              sublabel="Negocios locales"
              color="#34C759"
              onPress={() => router.push("/empresas" as any)}
            />
          </View>
        </View>

        {/* Aviso urgente */}
        {urgente && (
          <View style={{ marginHorizontal: 16, marginTop: 20, backgroundColor: "#FF3B3010", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#FF3B3025" }}>
            <Ionicons name="alert-circle" size={20} color={Colors.danger} />
            <Text style={{ color: "#FF3B30", fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 }} numberOfLines={2}>
              {urgente.titulo}
            </Text>
          </View>
        )}

        {/* Noticias destacadas */}
        {destacadas.length > 0 && (
          <>
            <SectionHeader title="Destacado" />
            {destacadas.map(n => <NoticiaCard key={n.id} noticia={n} destacada />)}
          </>
        )}

        {/* Últimas noticias */}
        <SectionHeader title="Últimas noticias" />

        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 14, backgroundColor: Colors.border, height: 88 }} />
            ))
          : resto.length > 0
            ? resto.map(n => <NoticiaCard key={n.id} noticia={n} />)
            : (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="newspaper-outline" size={44} color={Colors.textPlaceholder} />
                <Text style={{ color: Colors.textLight, marginTop: 10, fontFamily: "Inter_400Regular", fontSize: 15 }}>
                  Sin noticias todavía
                </Text>
              </View>
            )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* FAB publicar noticia */}
      {puedePublicar && (
        <TouchableOpacity
          onPress={() => router.push("/noticia/nueva" as any)}
          activeOpacity={0.85}
          style={{
            position: "absolute", bottom: 24, right: 20,
            backgroundColor: Colors.primary, width: 56, height: 56, borderRadius: 28,
            alignItems: "center", justifyContent: "center",
            shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 }, elevation: 6,
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}
