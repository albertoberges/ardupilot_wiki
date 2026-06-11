import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useEventos } from "@/hooks/useEventos";
import { EventoCard } from "@/components/EventoCard";
import { CategoriaEvento } from "@/lib/types";
import { Colors } from "@/constants/colors";

const categorias: { label: string; value: CategoriaEvento | undefined }[] = [
  { label: "Todos", value: undefined },
  { label: "Fiestas", value: "fiesta" },
  { label: "Cultural", value: "cultural" },
  { label: "Deporte", value: "deportivo" },
  { label: "Mercado", value: "mercado" },
  { label: "Reuniones", value: "reunion" },
  { label: "Formación", value: "formacion" },
];

export default function AgendaScreen() {
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaEvento | undefined>(undefined);
  const { eventos, loading, refreshing, refresh } = useEventos(categoriaActiva);

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
      >
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.label}
            style={{
              marginRight: 8,
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: categoriaActiva === cat.value ? Colors.primary : "#f1f3f4",
            }}
            onPress={() => setCategoriaActiva(cat.value)}
          >
            <Text style={{
              fontSize: 13,
              fontFamily: "Inter_500Medium",
              color: categoriaActiva === cat.value ? "#fff" : "#6b7280",
            }}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        <View style={{ paddingTop: 16 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 12, backgroundColor: "#e5e7eb", height: 96 }} />
            ))
          ) : eventos.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
              <Text style={{ color: "#9ca3af", fontSize: 15 }}>No hay eventos próximos</Text>
            </View>
          ) : (
            eventos.map((e) => <EventoCard key={e.id} evento={e} />)
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}
