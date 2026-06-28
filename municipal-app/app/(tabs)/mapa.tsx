import { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import MapView, { Marker, MapType } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLugares, crearLugar } from "@/hooks/useLugares";
import { useIncidencias, crearIncidencia } from "@/hooks/useIncidencias";
import { useAuth } from "@/hooks/useAuth";
import { Colors, CategoryColors } from "@/constants/colors";
import { CategoryLabels } from "@/lib/labels";
import { CategoriaIncidencia, CategoriaLugar } from "@/lib/types";

const REGION_INICIAL = {
  latitude: 41.6871,
  longitude: -0.7711,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

const MAPA_TIPOS: { tipo: MapType; icon: string; label: string }[] = [
  { tipo: "hybridFlyover", icon: "cube-outline",      label: "3D"       },
  { tipo: "hybrid",        icon: "satellite-outline", label: "Satélite" },
  { tipo: "standard",      icon: "map-outline",       label: "Normal"   },
];

const LUGAR_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  ayuntamiento:  { color: "#1d4ed8", icon: "business",    label: "Ayuntamiento" },
  iglesia:       { color: "#92400e", icon: "triangle",    label: "Iglesia" },
  parque:        { color: "#15803d", icon: "leaf",        label: "Parque" },
  colegio:       { color: "#ea580c", icon: "school",      label: "Colegio" },
  farmacia:      { color: "#dc2626", icon: "medical",     label: "Centro de Salud" },
  polideportivo: { color: "#0369a1", icon: "basketball",  label: "Instalación Deportiva" },
  plaza:         { color: "#7c3aed", icon: "compass",     label: "Plaza" },
  mercado:       { color: "#d97706", icon: "basket",      label: "Mercado" },
  museo:         { color: "#b45309", icon: "book",        label: "Centro Cultural" },
  otro:          { color: "#6b7280", icon: "location",    label: "Lugar de interés" },
};

const CATEGORIAS_LUGAR: CategoriaLugar[] = [
  "ayuntamiento", "iglesia", "parque", "colegio", "farmacia",
  "polideportivo", "plaza", "mercado", "museo", "otro",
];

const CATEGORIAS_INC: CategoriaIncidencia[] = [
  "viales", "alumbrado", "parques", "agua", "residuos", "edificios", "trafico", "otro",
];

type Capa = "lugares" | "incidencias";

export default function MapaScreen() {
  const mapRef = useRef<MapView>(null);
  const { user, profile } = useAuth();
  const esAdmin = profile?.role === "ayuntamiento" || profile?.role === "admin";

  const [capa, setCapa] = useState<Capa>("lugares");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [tipoMapaIdx, setTipoMapaIdx] = useState(2);

  // — Añadir incidencia —
  const [modoAnadir, setModoAnadir] = useState(false);
  const [coordNueva, setCoordNueva] = useState<{ latitude: number; longitude: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formTitulo, setFormTitulo] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formCategoria, setFormCategoria] = useState<CategoriaIncidencia>("otro");
  const [formDireccion, setFormDireccion] = useState("");
  const [enviando, setEnviando] = useState(false);

  // — Añadir lugar (solo admin/ayuntamiento) —
  const [modoAnadirLugar, setModoAnadirLugar] = useState(false);
  const [coordNuevaLugar, setCoordNuevaLugar] = useState<{ latitude: number; longitude: number } | null>(null);
  const [modalLugarVisible, setModalLugarVisible] = useState(false);
  const [lugarNombre, setLugarNombre] = useState("");
  const [lugarDesc, setLugarDesc] = useState("");
  const [lugarCat, setLugarCat] = useState<CategoriaLugar>("otro");
  const [lugarDir, setLugarDir] = useState("");
  const [lugarHorario, setLugarHorario] = useState("");
  const [lugarTel, setLugarTel] = useState("");
  const [enviandoLugar, setEnviandoLugar] = useState(false);

  const tipoMapa = MAPA_TIPOS[tipoMapaIdx];
  const { lugares, refresh: refreshLugares } = useLugares();
  const { incidencias, refresh: refreshInc } = useIncidencias();

  const lugarActivo = capa === "lugares" && seleccionadoId
    ? lugares.find(l => l.id === seleccionadoId) ?? null : null;
  const incidenciaActiva = capa === "incidencias" && seleccionadoId
    ? incidencias.find(i => i.id === seleccionadoId) ?? null : null;

  const handleMapPress = (e: any) => {
    if (capa === "incidencias" && modoAnadir) {
      setCoordNueva(e.nativeEvent.coordinate);
      setModoAnadir(false);
      setModalVisible(true);
    } else if (capa === "lugares" && modoAnadirLugar) {
      setCoordNuevaLugar(e.nativeEvent.coordinate);
      setModoAnadirLugar(false);
      setModalLugarVisible(true);
    } else {
      setSeleccionadoId(null);
    }
  };

  // — Incidencias —
  const handleAnadir = () => {
    if (!user) { Alert.alert("Inicia sesión", "Necesitas una cuenta para reportar incidencias."); return; }
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
      refreshInc();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "No se pudo enviar la incidencia.");
    } finally {
      setEnviando(false);
    }
  };

  // — Lugares —
  const resetFormLugar = () => {
    setLugarNombre(""); setLugarDesc(""); setLugarCat("otro");
    setLugarDir(""); setLugarHorario(""); setLugarTel("");
    setCoordNuevaLugar(null); setModalLugarVisible(false);
  };

  const handleSubmitLugar = async () => {
    if (!lugarNombre.trim()) { Alert.alert("Error", "El nombre es obligatorio."); return; }
    if (!coordNuevaLugar) return;
    setEnviandoLugar(true);
    try {
      await crearLugar({
        nombre: lugarNombre.trim(),
        descripcion: lugarDesc.trim() || undefined,
        categoria: lugarCat,
        latitud: coordNuevaLugar.latitude,
        longitud: coordNuevaLugar.longitude,
        direccion: lugarDir.trim() || undefined,
        horario: lugarHorario.trim() || undefined,
        telefono: lugarTel.trim() || undefined,
      });
      Alert.alert("¡Lugar añadido!", "El lugar ya aparece en el mapa.");
      resetFormLugar();
      refreshLugares();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "No se pudo añadir el lugar.");
    } finally {
      setEnviandoLugar(false);
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
          const seleccionado = seleccionadoId === lugar.id;
          return (
            <Marker
              key={lugar.id}
              coordinate={{ latitude: lugar.latitud, longitude: lugar.longitud }}
              onPress={() => setSeleccionadoId(lugar.id)}
            >
              <View style={{
                width: seleccionado ? 54 : 44,
                height: seleccionado ? 54 : 44,
                borderRadius: seleccionado ? 27 : 22,
                backgroundColor: cfg.color,
                alignItems: "center", justifyContent: "center",
                borderWidth: seleccionado ? 4 : 3,
                borderColor: "#fff",
                shadowColor: seleccionado ? cfg.color : "#000",
                shadowOpacity: seleccionado ? 0.9 : 0.3,
                shadowRadius: seleccionado ? 12 : 4,
                elevation: seleccionado ? 12 : 6,
              }}>
                <Ionicons name={cfg.icon as any} size={seleccionado ? 26 : 20} color="#fff" />
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

        {coordNueva && <Marker coordinate={coordNueva} pinColor={Colors.primary} />}
        {coordNuevaLugar && <Marker coordinate={coordNuevaLugar} pinColor={Colors.secondary} />}
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
            onPress={() => { setCapa(val); setSeleccionadoId(null); setModoAnadir(false); setModoAnadirLugar(false); }}
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

      {/* FAB añadir incidencia */}
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

      {/* FAB añadir lugar (solo admin/ayuntamiento) */}
      {capa === "lugares" && esAdmin && (
        <TouchableOpacity
          onPress={() => { setModoAnadirLugar(v => !v); setSeleccionadoId(null); }}
          style={{
            position: "absolute", bottom: 32, right: 16,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: modoAnadirLugar ? "#ef4444" : Colors.secondary,
            alignItems: "center", justifyContent: "center",
            shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
          }}
        >
          <Ionicons name={modoAnadirLugar ? "close" : "add"} size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Instrucción modo añadir incidencia */}
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

      {/* Instrucción modo añadir lugar */}
      {modoAnadirLugar && (
        <View style={{
          position: "absolute", bottom: 104, left: 24, right: 80,
          backgroundColor: "#fff", borderRadius: 16, padding: 14,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}>
          <Ionicons name="hand-left-outline" size={22} color={Colors.secondary} />
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#374151", flex: 1 }}>
            Toca en el mapa para colocar el nuevo lugar
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
              <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular" }}>
                {(LUGAR_CONFIG[lugarActivo.categoria] ?? LUGAR_CONFIG.otro).label}
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
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 8 }}>Tipo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {CATEGORIAS_INC.map(cat => (
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
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Título *</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 14, fontFamily: "Inter_400Regular" }}
                  placeholder="Ej: Farola apagada en calle Mayor"
                  value={formTitulo}
                  onChangeText={setFormTitulo}
                />
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Descripción</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 14, height: 80, textAlignVertical: "top", fontFamily: "Inter_400Regular" }}
                  placeholder="Describe el problema con más detalle..."
                  value={formDescripcion}
                  onChangeText={setFormDescripcion}
                  multiline
                />
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

      {/* Modal nuevo lugar (admin/ayuntamiento) */}
      <Modal visible={modalLugarVisible} animationType="slide" transparent onRequestClose={resetFormLugar}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={resetFormLugar} />
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" }}>Añadir lugar</Text>
                <TouchableOpacity onPress={resetFormLugar}>
                  <Ionicons name="close-circle" size={26} color="#d1d5db" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Categoría */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 8 }}>Tipo de lugar</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {CATEGORIAS_LUGAR.map(cat => {
                      const cfg = LUGAR_CONFIG[cat];
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setLugarCat(cat)}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                            borderColor: lugarCat === cat ? cfg.color : "#e5e7eb",
                            backgroundColor: lugarCat === cat ? cfg.color + "15" : "#fff",
                            flexDirection: "row", alignItems: "center", gap: 6,
                          }}
                        >
                          <Ionicons name={cfg.icon as any} size={13} color={lugarCat === cat ? cfg.color : "#6b7280"} />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: lugarCat === cat ? cfg.color : "#6b7280" }}>
                            {cfg.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Nombre */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Nombre *</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 14, fontFamily: "Inter_400Regular" }}
                  placeholder="Ej: Parque de la Constitución"
                  value={lugarNombre}
                  onChangeText={setLugarNombre}
                />

                {/* Descripción */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Descripción</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 14, height: 70, textAlignVertical: "top", fontFamily: "Inter_400Regular" }}
                  placeholder="Breve descripción del lugar..."
                  value={lugarDesc}
                  onChangeText={setLugarDesc}
                  multiline
                />

                {/* Dirección */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Dirección</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 14, fontFamily: "Inter_400Regular" }}
                  placeholder="Ej: Calle Mayor, 1"
                  value={lugarDir}
                  onChangeText={setLugarDir}
                />

                {/* Horario */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Horario</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 14, fontFamily: "Inter_400Regular" }}
                  placeholder="Ej: L-V 9:00-14:00"
                  value={lugarHorario}
                  onChangeText={setLugarHorario}
                />

                {/* Teléfono */}
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 6 }}>Teléfono</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827", marginBottom: 24, fontFamily: "Inter_400Regular" }}
                  placeholder="Ej: 976 123 456"
                  value={lugarTel}
                  onChangeText={setLugarTel}
                  keyboardType="phone-pad"
                />

                <TouchableOpacity
                  onPress={handleSubmitLugar}
                  disabled={enviandoLugar}
                  style={{ backgroundColor: Colors.secondary, borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: enviandoLugar ? 0.7 : 1 }}
                >
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                    {enviandoLugar ? "Guardando..." : "Añadir al mapa"}
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
