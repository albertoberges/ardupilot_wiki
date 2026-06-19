import { View, Text, ScrollView, Image, TouchableOpacity, Alert, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAnuncio, eliminarAnuncio, actualizarAnuncio, EstadoAnuncio } from "@/hooks/useMercado";
import { useAuth } from "@/hooks/useAuth";
import { Colors } from "@/constants/colors";

const CAT_LABEL: Record<string, string> = {
  electronica: "Electrónica", ropa: "Ropa", hogar: "Hogar",
  deporte: "Deporte", motor: "Motor", libros: "Libros",
  juguetes: "Juguetes", otros: "Otros",
};

const CAT_COLOR: Record<string, string> = {
  electronica: "#2471a3", ropa: "#8e44ad", hogar: "#e67e22",
  deporte: "#16a085", motor: "#c0392b", libros: "#d4a017",
  juguetes: "#e74c3c", otros: "#7f8c8d",
};

const CAT_ICON: Record<string, string> = {
  electronica: "phone-portrait", ropa: "shirt", hogar: "home",
  deporte: "football", motor: "car", libros: "book",
  juguetes: "game-controller", otros: "cube",
};

const ESTADO_LABEL: Record<EstadoAnuncio, string> = {
  activo: "Disponible", reservado: "Reservado", vendido: "Vendido",
};

const ESTADO_COLOR: Record<EstadoAnuncio, string> = {
  activo: "#27ae60", reservado: "#f39c12", vendido: "#e74c3c",
};

export default function AnuncioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { anuncio, loading } = useAnuncio(id);

  const esPropio = user?.id === anuncio?.vendedor_id;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#9ca3af", fontFamily: "Inter_400Regular" }}>Cargando...</Text>
      </View>
    );
  }

  if (!anuncio) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#9ca3af", fontFamily: "Inter_400Regular" }}>Anuncio no encontrado</Text>
      </View>
    );
  }

  async function handleEliminar() {
    Alert.alert("Eliminar anuncio", "¿Seguro que quieres eliminar este anuncio?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarAnuncio(anuncio!.id);
            router.back();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  }

  async function handleCambiarEstado(estado: EstadoAnuncio) {
    try {
      await actualizarAnuncio(anuncio!.id, { estado });
      Alert.alert("Estado actualizado", `Anuncio marcado como "${ESTADO_LABEL[estado]}"`);
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  }

  const catColor = CAT_COLOR[anuncio.categoria] ?? "#7f8c8d";
  const catIcon = CAT_ICON[anuncio.categoria] ?? "cube";

  const vendedorNombre = anuncio.vendedor
    ? `${anuncio.vendedor.nombre} ${anuncio.vendedor.apellidos}`
    : "Vendedor";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      {/* Imagen */}
      {anuncio.imagen_url ? (
        <Image
          source={{ uri: anuncio.imagen_url }}
          style={{ width: "100%", height: 280, backgroundColor: "#e2e8f0" }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: "100%", height: 220, backgroundColor: catColor + "20", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={catIcon as any} size={72} color={catColor} />
        </View>
      )}

      <View style={{ padding: 16 }}>
        {/* Categoría y estado */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <View style={{ backgroundColor: catColor + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: catColor, fontSize: 12, fontFamily: "Inter_500Medium" }}>
              {CAT_LABEL[anuncio.categoria] ?? anuncio.categoria}
            </Text>
          </View>
          <View style={{ backgroundColor: ESTADO_COLOR[anuncio.estado] + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: ESTADO_COLOR[anuncio.estado], fontSize: 12, fontFamily: "Inter_500Medium" }}>
              {ESTADO_LABEL[anuncio.estado]}
            </Text>
          </View>
        </View>

        {/* Título */}
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: "#1a202c", marginBottom: 8 }}>
          {anuncio.titulo}
        </Text>

        {/* Precio */}
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 28, color: anuncio.gratis ? "#27ae60" : Colors.primary, marginBottom: 4 }}>
          {anuncio.gratis ? "Gratis" : anuncio.precio ? `${anuncio.precio.toFixed(2)} €` : "A convenir"}
        </Text>
        {anuncio.precio_negociable && !anuncio.gratis && (
          <Text style={{ color: "#6c757d", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 12 }}>
            Precio negociable
          </Text>
        )}

        {/* Descripción */}
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#4a5568", lineHeight: 22, marginTop: 8 }}>
          {anuncio.descripcion}
        </Text>

        {/* Vendedor */}
        <View style={{
          marginTop: 20,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person" size={22} color={Colors.primary} />
          </View>
          <View>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#1a202c" }}>{vendedorNombre}</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#9ca3af" }}>
              Publicado el {new Date(anuncio.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </Text>
          </View>
        </View>

        {/* Botones si es propio */}
        {esPropio && (
          <View style={{ marginTop: 20, gap: 10 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#4a5568", marginBottom: 4 }}>
              Cambiar estado del anuncio
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["activo", "reservado", "vendido"] as EstadoAnuncio[]).map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => handleCambiarEstado(e)}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: anuncio.estado === e ? ESTADO_COLOR[e] : "#f1f3f4",
                  }}
                >
                  <Text style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    color: anuncio.estado === e ? "#fff" : "#6c757d",
                  }}>
                    {ESTADO_LABEL[e]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={handleEliminar}
              style={{
                backgroundColor: "#e74c3c",
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                Eliminar anuncio
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}
