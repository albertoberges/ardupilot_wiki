import { useState, useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import MapView, { Marker, MapType } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLugares } from "@/hooks/useLugares";
import { useIncidencias } from "@/hooks/useIncidencias";
import { Colors, CategoryColors } from "@/constants/colors";

const REGION_INICIAL = {
  latitude: 41.705,
  longitude: -0.883,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const MAPA_TIPOS: { tipo: MapType; icon: string; label: string }[] = [
  { tipo: "standard",      icon: "map-outline",      label: "Normal"    },
  { tipo: "hybrid",        icon: "satellite-outline", label: "Satélite"  },
  { tipo: "hybridFlyover", icon: "cube-outline",      label: "3D"        },
];
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

type Capa = "lugares" | "incidencias";

export default function MapaScreen() {
  const mapRef = useRef<MapView>(null);
  const [capa, setCapa] = useState<Capa>("lugares");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [tipoMapaIdx, setTipoMapaIdx] = useState(0);
  const tipoMapa = MAPA_TIPOS[tipoMapaIdx];

  const { lugares } = useLugares();
  const { incidencias } = useIncidencias();

  const lugarActivo = capa === "lugares" && seleccionadoId
    ? lugares.find(l => l.id === seleccionadoId) ?? null
    : null;
  const incidenciaActiva = capa === "incidencias" && seleccionadoId
    ? incidencias.find(i => i.id === seleccionadoId) ?? null
    : null;

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
      </MapView>

      {/* Toggle de capas */}
      <View style={{
        position: "absolute", top: 12, alignSelf: "center",
        flexDirection: "row",
        backgroundColor: "#fff", borderRadius: 28, padding: 4,
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
      }}>
        {([
          ["lugares",     "location",  "Lugares"],
          ["incidencias", "warning",   "Incidencias"],
        ] as [Capa, string, string][]).map(([val, icon, label]) => (
          <TouchableOpacity
            key={val}
            onPress={() => { setCapa(val); setSeleccionadoId(null); }}
            style={{
              flexDirection: "row", alignItems: "center",
              paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22,
              backgroundColor: capa === val ? Colors.primary : "transparent",
              gap: 6,
            }}
          >
            <Ionicons name={icon as any} size={14} color={capa === val ? "#fff" : "#6b7280"} />
            <Text style={{
              fontSize: 13, fontFamily: "Inter_600SemiBold",
              color: capa === val ? "#fff" : "#6b7280",
            }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tarjeta de lugar seleccionado */}
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

      {lugarActivo && (
        <View style={{
          position: "absolute", bottom: 24, left: 16, right: 16,
          backgroundColor: "#fff", borderRadius: 20, padding: 16,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14, elevation: 8,
        }}>
          <TouchableOpacity
            style={{ position: "absolute", top: 12, right: 12 }}
            onPress={() => setSeleccionadoId(null)}
          >
            <Ionicons name="close-circle" size={22} color="#d1d5db" />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{
              width: 46, height: 46, borderRadius: 14,
              backgroundColor: (LUGAR_CONFIG[lugarActivo.categoria] ?? LUGAR_CONFIG.otro).color,
              alignItems: "center", justifyContent: "center", marginRight: 12,
            }}>
              <Ionicons
                name={(LUGAR_CONFIG[lugarActivo.categoria] ?? LUGAR_CONFIG.otro).icon as any}
                size={22} color="#fff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" }}>
                {lugarActivo.nombre}
              </Text>
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
                  <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular", flex: 1 }}>
                    {lugarActivo.direccion}
                  </Text>
                </View>
              )}
              {lugarActivo.horario && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="time-outline" size={14} color="#6b7280" />
                  <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular", flex: 1 }}>
                    {lugarActivo.horario}
                  </Text>
                </View>
              )}
              {lugarActivo.telefono && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="call-outline" size={14} color="#6b7280" />
                  <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular" }}>
                    {lugarActivo.telefono}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Tarjeta de incidencia seleccionada */}
      {incidenciaActiva && (
        <View style={{
          position: "absolute", bottom: 24, left: 16, right: 16,
          backgroundColor: "#fff", borderRadius: 20, padding: 16,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14, elevation: 8,
        }}>
          <TouchableOpacity
            style={{ position: "absolute", top: 12, right: 12 }}
            onPress={() => setSeleccionadoId(null)}
          >
            <Ionicons name="close-circle" size={22} color="#d1d5db" />
          </TouchableOpacity>
          <View style={{
            alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 20, marginBottom: 8,
            backgroundColor: (CategoryColors[incidenciaActiva.estado] ?? Colors.danger) + "22",
          }}>
            <Text style={{
              fontSize: 11, fontFamily: "Inter_600SemiBold",
              color: CategoryColors[incidenciaActiva.estado] ?? Colors.danger,
              textTransform: "capitalize",
            }}>
              {incidenciaActiva.estado.replace(/_/g, " ")}
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", paddingRight: 28 }}>
            {incidenciaActiva.titulo}
          </Text>
          {incidenciaActiva.direccion_aproximada && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Ionicons name="location-outline" size={13} color="#6b7280" />
              <Text style={{ fontSize: 12, color: "#6b7280", fontFamily: "Inter_400Regular" }}>
                {incidenciaActiva.direccion_aproximada}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Ionicons name="thumbs-up-outline" size={13} color="#6b7280" />
            <Text style={{ fontSize: 12, color: "#6b7280" }}>{incidenciaActiva.votos} apoyos</Text>
          </View>
        </View>
      )}
    </View>
  );
}
