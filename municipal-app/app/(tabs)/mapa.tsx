import { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import MapView, { Marker, MapType } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLugares } from "@/hooks/useLugares";
import { useIncidencias, crearIncidencia } from "@/hooks/useIncidencias";
import { useAuth } from "@/hooks/useAuth";
import { Colors, CategoryColors } from "@/constants/colors";
import { CategoryLabels } from "@/lib/labels";
import { CategoriaIncidencia } from "@/lib/types";

const REGION_INICIAL = {
  latitude: 41.784,
  longitude: -0.814,
  latitudeDelta: 0.010,
  longitudeDelta: 0.010,
};

const MAPA_TIPOS: { tipo: MapType; icon: string; label: string }[] = [
  { tipo: "hybrid",        icon: "satellite-outline", label: "Satélite" },
  { tipo: "hybridFlyover", icon: "cube-outline",      label: "3D"       },
  { tipo: "standard",      icon: "map-outline",       label: "Normal"   },
];

const LUGAR_CONFIG: Record<string, { color: string; icon: string }> = {
  ayuntamiento:  { color: "#1d4ed8", icon: "business" },
  iglesia:       { color: "#92400e", icon: "triangle" },
  parque:        { color: "#15803d", icon: "leaf" },
  colegio:       { color: "#ea580c", icon: "school" },
  farmacia:      { color: "#dc2626", icon: "medical" },
  polideportivo: { color: "#0369a1", icon: "basketball" },
  plaza:         { color: "#7c3aed", icon: "compass" },
  mercado:       { color: "#d97706", icon: "basket" },
  museo:         { color: "#b45309", icon: "book" },
  otro:          { color: "#6b7280", icon: "location" },
};

const CATEGORIAS: CategoriaIncidencia[] = [
  "viales", "alumbrado", "parques", "agua", "residuos", "edificios", "trafico", "otro",
];

type Capa = "lugares" | "incidencias";

export default function MapaScreen() {
  const mapRef = useRef<MapView>(null);
  const { user } = useAuth();

  const [capa, setCapa] = useState<Capa>("lugares");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [tipoMapaIdx, setTipoMapaIdx] = useState(0);

  const [modoAnadir, setModoAnadir] = useState(false);
  const [coordNueva, setCoordNueva] = useState<{ latitude: number; longitude: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formTitulo, setFormTitulo] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formCategoria, setFormCategoria] = useState<CategoriaIncidencia>("otro");
  const [formDireccion, setFormDireccion] = useState("");
  const [enviando, setEnviando] = useState(false);

  const tipoMapa = MAPA_TIPOS[tipoMapaIdx];
  const { lugares } = useLugares();
  const { incidencias, refresh } = useIncidencias();

  const lugarActivo = capa === "lugares" && seleccionadoId
    ? lugares.find(l => l.id === seleccionadoId) ?? null : null;
  const incidenciaActiva = capa === "incidencias" && seleccionadoId
    ? incidencias.find(i => i.id === seleccionadoId) ?? null : null;

  const handleMapPress = (e: any) => {
    if (capa === "incidencias" && modoAnadir) {
      setCoordNueva(e.nativeEvent.coordinate);
      setModoAnadir(false);
      setModalVisible(true);
    } else {
      setSeleccionadoId(null);
    }
  };

  const handleAnadir = () => {
    if (!user) {
      Alert.alert("Inicia sesión", "Necesitas una cuenta para reportar incidencias.");
      return;
    }
    setModoAnadir(v => !v);
    setSeleccionadoId(null);
  };

  const resetForm = () => {
    setFormTitulo(""); setFormDescripcion("");
    setFormCategoria("otro"); setFormDireccion("");
    setCoordNueva(null); setModalVisible(false);
  };

  const handleSubmit = async () => {
    if (!formTitulo.trim()) { Alert.alert("Error", "El título es obligatorio."); return; }
    if (!coordNueva || !user) return;
    setEnviando(true);
    try {
      await crearIncidencia({
        titulo: formTitulo.trim(),
        descripcion: formDescripcion.trim(),
        categoria: formCategoria,
        latitud: coordNueva.latitude,
        longitud: coordNueva.longitude,
        direccion_aproximada: formDireccion.trim() || undefined,
        reportado_por: user.id,
      });
      Alert.alert("¡Incidencia reportada!", "Tu reporte ha sido enviado al ayuntamiento.");
      resetForm();
      refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "No se pudo enviar la incidencia.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={REGION_INICIAL}
        mapType={tipoMapa.tipo}
        showsUserLocation
        showsMyLocationButton
        showsBuildings
        showsCompass
        pitchEnabled
        rotateEnabled
        onPress={handleMapPress}
      >
        {capa === "lugares" && lugares.map(lugar => {
          const cfg = LUGAR_CONFIG[lugar.categoria] ?? LUGAR_CONFIG.otro;
          return (
            <Marker
              key={lugar.id}
              coordinate={{ latitude: lugar.latitud, longitude: lugar.longitud }}
              onPress={() => setSeleccionadoId(lugar.id)}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: cfg.color,
                alignItems: "center", justifyContent: "center",
                borderWidth: 3, borderColor: "#fff",
                shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 6,
              }}>
                <Ionicons name={cfg.icon as any} size={20} color="#fff" />
              </View>
            </Marker>
          );
        })}

        {capa === "incidencias" && incidencias
          .filter(i => i.latitud && i.longitud)
          .map(inc => (
            <Marker
              key={inc.id}
              coordinate={{ latitude: inc.latitud!, longitude: inc.longitud! }}
              pinColor={CategoryColors[inc.estado] ?? Colors.danger}
              onPress={() => setSeleccionadoId(inc.id)}
            />
          ))
        }

        {coordNueva && (
          <Marker coordinate={coordNueva} pinColor={Colors.primary} />
        )}
      </MapView>

      {/* Toggle capas */}
      <View style={{
        position: "absolute", top: 12, alignSelf: "center",
        flexDirection: "row", backgroundColor: "#fff",
        borderRadius: 28, padding: 4,
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
      }}>
        {([ ["lugares", "location", "Lugares"], ["incidencias", "warning", "Incidencias"] ] as [Capa, string, string][]).map(([val, icon, label]) => (
          <TouchableOpacity
            key={val}
            onPress={() => { setCapa(val); setSeleccionadoId(null); setModoAnadir(false); }}
            style={{
              flexDirection: "row", alignItems: "center",
              paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22,
              backgroundColor: capa === val ? Colors.primary : "transparent", gap: 6,
            }}
          >
            <Ionicons name={icon as any} size={14} color={capa === val ? "#fff" : "#6b7280"} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: capa === val ? "#fff" : "#6b7280" }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Botón tipo de mapa */}
      <TouchableOpacity
        onPress={() => setTipoMapaIdx((tipoMapaIdx + 1) % MAPA_TIPOS.length)}
        style={{
          position: "absolute", top: 12, right: 12,
          backgroundColor: "#fff", borderRadius: 14,
          paddingHorizontal: 12, paddingVertical: 9,
          flexDirection: "row", alignItems: "center", gap: 6,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
        }}
      >
        <Ionicons name={tipoMapa.icon as any} size={16} color={Colors.primary} />
        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary }}>
          {tipoMapa.label}
        </Text>
      </TouchableOpacity>

      {/* Botón añadir incidencia */}
      {capa === "incidencias" && (
        <TouchableOpacity
          onPress={handleAnadir}
          style={{
            position: "absolute", bottom: 32, right: 16,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: modoAnadir ? "#ef4444" : Colors.primary,
            alignItems: "center", justifyContent: "center",
            shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
          }}
        >
          <Ionicons name={modoAnadir ? "close" : "add"} size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Instrucción modo añadir */}
      {modoAnadir && (
        <View style={{
          position: "absolute", bottom: 104, left: 24, right: 80,
          backgroundColor: "#fff", borderRadius: 16, padding: 14,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}>
          <Ionicons name="hand-left-outline" size={22} color={Colors.primary} />
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#374151", flex: 1 }}>
            Toca en el mapa para marcar la ubicación
          </Text>
        </View>
      )}

      {/* Tarjeta lugar */}
      {lugarActivo && (
        <View style={{
          position: "absolute", bottom: 24, left: 16, right: 16,
          backgroundColor: "#fff", borderRadius: 20, padding: 16,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14, elevation: 8,
        }}>
          <TouchableOpacity style={{ position: "absolute", top: 12, right: 12 }} onPress={() => setSeleccionadoId(null)}>
            <Ionicons name="close-circle" size={22} color="#d1d5db" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{
              width: 46, height: 46, borderRadius: 14, marginRight: 12,
              backgroundColor: (LUGAR_CONFIG[lugarActivo.categoria] ?? LUGAR_CONFIG.otro).color,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name={(LUGAR_CONFIG[lugarActivo.categoria] ?? LUGAR_CONFIG.otro).icon as any} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" }}>{lugarActivo.nombre}</Text>
              <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular", textTransform: "capitalize" }}>
                {lugarActivo.categoria.replace(/_/g, " ")}
              </Text>
            </View>
          </View>
          {lugarActivo.descripcion && (
            <Text style={{ fontSize: 13, color: "#4b5563", fontFamily: "Inter_400Regular", marginBottom: 10 }}>
              {lugarActivo.descripcion}
            </Text>
          )}
          {(lugarActivo.direccion || lugarActivo.horario || lugarActivo.telefono) && (
            <View style={{ borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 10, gap: 6 }}>
              {lugarActivo.direccion && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="location-outline" size={14} color="#6b7280" />
                  <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular", flex: 1 }}>{lugarActivo.direccion}</Text>
                </View>
              )}
              {lugarActivo.horario && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="time-outline" size={14} color="#6b7280" />
                  <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular", flex: 1 }}>{lugarActivo.horario}</Text>
                </View>
              )}
              {lugarActivo.telefono && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="call-outline" size={14} color="#6b7280" />
                  <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular" }}>{lugarActivo.telefono}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Tarjeta incidencia */}
      {incidenciaActiva && (
        <View style={{
          position: "absolute", bottom: 24, left: 16, right: 16,
          backgroundColor: "#fff", borderRadius: 20, padding: 16,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14, elevation: 8,
        }}>
          <TouchableOpacity style={{ position: "absolute", top: 12, right: 12 }} onPress={() => setSeleccionadoId(null)}>
            <Ionicons name="close-circle" size={22} color="#d1d5db" />
          </TouchableOpacity>
          <View style={{
            alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 20, marginBottom: 8,
            backgroundColor: (CategoryColors[incidenciaActiva.estado] ?? Colors.danger) + "22",
          }}>
            <Text style={{
              fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize",
              color: CategoryColors[incidenciaActiva.estado] ?? Colors.danger,
            }}>
              {CategoryLabels.estado[incidenciaActiva.estado]}
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", paddingRight: 28 }}>
            {incidenciaActiva.titulo}
          </Text>
          {incidenciaActiva.direccion_aproximada && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Ionicons name="location-outline" size={13} color="#6b7280" />
              <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular" }}>{incidenciaActiva.direccion_aproximada}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Ionicons name="thumbs-up-outline" size={13} color="#6b7280" />
            <Text style={{ fontSize: 12, color: "#6b7280" }}>{incidenciaActiva.votos} apoyos</Text>
          </View>
        </View>
      )}

      {/* Modal nueva incidencia */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={resetForm}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={resetForm} />
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" }}>Nueva incidencia</Text>
                <TouchableOpacity onPress={resetForm}>
                  <Ionicons name="close-circle" size={26} color="#d1d5db" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Categoría */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 8 }}>Tipo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {CATEGORIAS.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setFormCategoria(cat)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                          borderColor: formCategoria === cat ? Colors.primary : "#e5e7eb",
                          backgroundColor: formCategoria === cat ? Colors.primary + "10" : "#fff",
                        }}
                      >
                        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: formCategoria === cat ? Colors.primary : "#6b7280" }}>
                          {CategoryLabels.incidencia[cat]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Título */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Título *</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 14, fontFamily: "Inter_400Regular" }}
                  placeholder="Ej: Farola apagada en calle Mayor"
                  value={formTitulo}
                  onChangeText={setFormTitulo}
                />

                {/* Descripción */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Descripción</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 14, height: 80, textAlignVertical: "top", fontFamily: "Inter_400Regular" }}
                  placeholder="Describe el problema con más detalle..."
                  value={formDescripcion}
                  onChangeText={setFormDescripcion}
                  multiline
                />

                {/* Dirección aproximada */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Dirección aproximada</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 24, fontFamily: "Inter_400Regular" }}
                  placeholder="Ej: Calle Mayor, 5"
                  value={formDireccion}
                  onChangeText={setFormDireccion}
                />

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={enviando}
                  style={{ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: enviando ? 0.7 : 1 }}
                >
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                    {enviando ? "Enviando..." : "Reportar incidencia"}
                  </Text>
                </TouchableOpacity>
                <View style={{ height: 16 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
