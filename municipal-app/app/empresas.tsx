import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Linking, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Colors } from "@/constants/colors";

const CAT_COLORS = ["#1a5276", "#8e44ad", "#c0392b", "#16a085", "#e67e22", "#2471a3", "#27ae60", "#d35400"];

function colorCategoria(texto: string): string {
  let h = 0;
  for (const c of texto) h = c.charCodeAt(0) + ((h << 5) - h);
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}

export default function EmpresasScreen() {
  const { empresas, loading, refreshing, refresh } = useEmpresas();
  const [busqueda, setBusqueda] = useState("");

  const filtradas = busqueda.trim()
    ? empresas.filter(
        (e) =>
          e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (e.categoria ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
          (e.servicios ?? []).some((s) => s.toLowerCase().includes(busqueda.toLowerCase()))
      )
    : empresas;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      {/* Buscador */}
      <View style={{ backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f1f3f4", borderRadius: 10, paddingHorizontal: 10 }}>
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            style={{ flex: 1, paddingVertical: 9, paddingLeft: 8, fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a202c" }}
            placeholder="Buscar empresas o servicios..."
            placeholderTextColor="#9ca3af"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda("")}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        {filtradas.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
            <Ionicons name="briefcase-outline" size={48} color="#d1d5db" />
            <Text style={{ color: "#9ca3af", fontSize: 15, marginTop: 12 }}>
              {busqueda ? "Sin resultados" : "No hay empresas registradas"}
            </Text>
          </View>
        ) : (
          filtradas.map((empresa) => {
            const inicial = empresa.nombre.charAt(0).toUpperCase();
            const color = colorCategoria(empresa.nombre);

            return (
              <View
                key={empresa.id}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 14,
                  padding: 14,
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  {/* Logo inicial */}
                  <View style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: color,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" }}>{inicial}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#1a202c" }} numberOfLines={1}>
                      {empresa.nombre}
                    </Text>
                    {empresa.categoria && (
                      <View style={{ marginTop: 4 }}>
                        <View style={{ backgroundColor: color + "18", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: "flex-start" }}>
                          <Text style={{ color: color, fontSize: 11, fontFamily: "Inter_500Medium" }}>{empresa.categoria}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {empresa.descripcion ? (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#6c757d", marginTop: 10, lineHeight: 19 }} numberOfLines={3}>
                    {empresa.descripcion}
                  </Text>
                ) : null}

                {empresa.servicios && empresa.servicios.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {empresa.servicios.slice(0, 5).map((s, i) => (
                      <View key={i} style={{ backgroundColor: "#f1f3f4", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#4a5568" }}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {empresa.direccion ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                    <Ionicons name="location-outline" size={14} color="#9ca3af" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#9ca3af", flex: 1 }} numberOfLines={1}>
                      {empresa.direccion}
                    </Text>
                  </View>
                ) : null}

                {empresa.horario ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Ionicons name="time-outline" size={14} color="#9ca3af" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#9ca3af", flex: 1 }} numberOfLines={1}>
                      {empresa.horario}
                    </Text>
                  </View>
                ) : null}

                {/* Botones de contacto */}
                {(empresa.telefono || empresa.email) && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    {empresa.telefono && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${empresa.telefono}`)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          backgroundColor: Colors.primary,
                          borderRadius: 10,
                          paddingVertical: 9,
                        }}
                      >
                        <Ionicons name="call" size={16} color="#fff" />
                        <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" }}>Llamar</Text>
                      </TouchableOpacity>
                    )}
                    {empresa.email && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`mailto:${empresa.email}`)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          backgroundColor: "#f1f3f4",
                          borderRadius: 10,
                          paddingVertical: 9,
                        }}
                      >
                        <Ionicons name="mail" size={16} color={Colors.primary} />
                        <Text style={{ color: Colors.primary, fontSize: 13, fontFamily: "Inter_500Medium" }}>Email</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
