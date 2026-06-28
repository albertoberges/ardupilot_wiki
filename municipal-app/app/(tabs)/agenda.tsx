import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEventosMes, crearEvento } from "@/hooks/useEventos";
import { useAuth } from "@/hooks/useAuth";
import { CategoriaEvento } from "@/lib/types";
import { Colors } from "@/constants/colors";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const CATS: { value: CategoriaEvento; label: string; color: string }[] = [
  { value: "fiesta",    label: "Fiesta",     color: "#c0392b" },
  { value: "cultural",  label: "Cultural",   color: "#8e44ad" },
  { value: "deportivo", label: "Deporte",    color: "#16a085" },
  { value: "mercado",   label: "Mercado",    color: "#27ae60" },
  { value: "reunion",   label: "Reunión",    color: "#2471a3" },
  { value: "formacion", label: "Formación",  color: "#f39c12" },
  { value: "otro",      label: "Otro",       color: "#7f8c8d" },
];

function catColor(cat: CategoriaEvento) {
  return CATS.find(c => c.value === cat)?.color ?? "#7f8c8d";
}

function formatHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default function AgendaScreen() {
  const { profile } = useAuth();
  const puedeCrear = ["ayuntamiento", "admin", "asociacion"].includes(profile?.role ?? "");

  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoy.getDate());
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Formulario
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<CategoriaEvento>("cultural");
  const [fechaStr, setFechaStr] = useState("");
  const [horaStr, setHoraStr] = useState("10:00");
  const [lugar, setLugar] = useState("");
  const [organizador, setOrganizador] = useState(profile?.nombre_organizacion ?? profile?.nombre ?? "");

  const { eventos, loading } = useEventosMes(mes, anio);

  // Calendario
  const primerDia = new Date(anio, mes, 1).getDay();
  const offset = primerDia === 0 ? 6 : primerDia - 1;
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  const eventosPorDia: Record<number, typeof eventos> = {};
  eventos.forEach(e => {
    const d = new Date(e.fecha_inicio).getDate();
    if (!eventosPorDia[d]) eventosPorDia[d] = [];
    eventosPorDia[d].push(e);
  });

  const eventosDia = eventosPorDia[diaSeleccionado] ?? [];

  function cambiarMes(delta: number) {
    const nueva = new Date(anio, mes + delta, 1);
    setMes(nueva.getMonth());
    setAnio(nueva.getFullYear());
    setDiaSeleccionado(1);
  }

  function resetForm() {
    setTitulo(""); setDescripcion(""); setCategoria("cultural");
    setFechaStr(""); setHoraStr("10:00"); setLugar("");
    setOrganizador(profile?.nombre_organizacion ?? profile?.nombre ?? "");
  }

  async function handleCrear() {
    if (!titulo.trim() || !fechaStr.trim() || !lugar.trim()) {
      Alert.alert("Faltan datos", "Título, fecha y lugar son obligatorios.");
      return;
    }
    const fechaParsed = parseFecha(fechaStr);
    const fechaDate = new Date(`${fechaParsed}T${horaStr}:00`);
    if (isNaN(fechaDate.getTime())) {
      Alert.alert("Fecha inválida", "Usa el formato DD/MM/AAAA");
      return;
    }
    const fechaISO = fechaDate.toISOString();
    setGuardando(true);
    try {
      await crearEvento({
        titulo: titulo.trim(), descripcion: descripcion.trim(),
        categoria, fecha_inicio: fechaISO,
        lugar: lugar.trim(), organizador: organizador.trim() || "Ayuntamiento",
      });
      setModal(false); resetForm();
      Alert.alert("Evento creado", "El evento ya aparece en la agenda.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setGuardando(false); }
  }

  // Parsear fecha input DD/MM/AAAA → AAAA-MM-DD
  function parseFecha(input: string) {
    const parts = input.split("/");
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
    return input;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <ScrollView>
        {/* Navegación mes */}
        <View style={{ backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity onPress={() => cambiarMes(-1)} style={{ padding: 6 }}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" }}>
            {MESES[mes]} {anio}
          </Text>
          <TouchableOpacity onPress={() => cambiarMes(1)} style={{ padding: 6 }}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Cabecera días semana */}
        <View style={{ backgroundColor: Colors.primary, flexDirection: "row", paddingBottom: 8, paddingHorizontal: 4 }}>
          {DIAS_SEMANA.map(d => (
            <View key={d} style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium" }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid días */}
        <View style={{ backgroundColor: "#fff", flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
          {Array.from({ length: offset }).map((_, i) => (
            <View key={`e${i}`} style={{ width: "14.28%", aspectRatio: 1 }} />
          ))}
          {Array.from({ length: diasEnMes }).map((_, i) => {
            const dia = i + 1;
            const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();
            const esSeleccionado = dia === diaSeleccionado;
            const tieneEventos = !!eventosPorDia[dia];
            const colores = tieneEventos ? [...new Set(eventosPorDia[dia].map(e => catColor(e.categoria)))].slice(0, 3) : [];

            return (
              <TouchableOpacity
                key={dia}
                onPress={() => setDiaSeleccionado(dia)}
                style={{ width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 }}
              >
                <View style={{
                  width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
                  backgroundColor: esSeleccionado ? Colors.primary : esHoy ? Colors.primary + "20" : "transparent",
                }}>
                  <Text style={{
                    fontSize: 14, fontFamily: esHoy || esSeleccionado ? "Inter_700Bold" : "Inter_400Regular",
                    color: esSeleccionado ? "#fff" : esHoy ? Colors.primary : "#1a202c",
                  }}>{dia}</Text>
                </View>
                {colores.length > 0 && (
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
                    {colores.map((c, idx) => (
                      <View key={idx} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Eventos del día seleccionado */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#6c757d", marginBottom: 12 }}>
            {diaSeleccionado} de {MESES[mes]}
          </Text>

          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : eventosDia.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Ionicons name="calendar-outline" size={36} color="#d1d5db" />
              <Text style={{ color: "#9ca3af", marginTop: 8, fontFamily: "Inter_400Regular" }}>
                Sin eventos este día
              </Text>
            </View>
          ) : (
            eventosDia.map(evento => (
              <View key={evento.id} style={{
                backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10,
                borderLeftWidth: 4, borderLeftColor: catColor(evento.categoria),
                shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#1a202c", flex: 1 }}>{evento.titulo}</Text>
                  <Text style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>{formatHora(evento.fecha_inicio)}</Text>
                </View>
                {evento.descripcion ? (
                  <Text style={{ color: "#6c757d", fontSize: 13, marginTop: 4 }} numberOfLines={2}>{evento.descripcion}</Text>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                  <Ionicons name="location-outline" size={13} color="#9ca3af" />
                  <Text style={{ fontSize: 12, color: "#9ca3af" }}>{evento.lugar}</Text>
                  <Text style={{ fontSize: 12, color: "#9ca3af", marginLeft: 6 }}>· {evento.organizador}</Text>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB crear evento */}
      {puedeCrear && (
        <TouchableOpacity
          onPress={() => { resetForm(); setFechaStr(`${String(diaSeleccionado).padStart(2,"0")}/${String(mes+1).padStart(2,"0")}/${anio}`); setModal(true); }}
          style={{
            position: "absolute", bottom: 24, right: 20,
            backgroundColor: Colors.primary, width: 56, height: 56, borderRadius: 28,
            alignItems: "center", justifyContent: "center",
            elevation: 6, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal crear evento */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 }}>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 18 }}>Nuevo evento</Text>
              <TouchableOpacity onPress={handleCrear} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Publicar</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              {[
                { label: "Título *", value: titulo, set: setTitulo, placeholder: "Nombre del evento" },
                { label: "Lugar *", value: lugar, set: setLugar, placeholder: "Dónde se celebra" },
                { label: "Fecha * (DD/MM/AAAA)", value: fechaStr, set: (v: string) => { setFechaStr(v); }, placeholder: "ej: 15/08/2026", keyboard: "numeric" },
                { label: "Hora (HH:MM)", value: horaStr, set: setHoraStr, placeholder: "10:00", keyboard: "numeric" },
                { label: "Organizador", value: organizador, set: setOrganizador, placeholder: "Nombre del organizador" },
              ].map(({ label, value, set, placeholder, keyboard }) => (
                <View key={label}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>{label}</Text>
                  <TextInput
                    style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0" }}
                    placeholder={placeholder} placeholderTextColor="#9ca3af"
                    value={value} onChangeText={set}
                    keyboardType={keyboard as any ?? "default"}
                    onBlur={label.includes("Fecha") ? () => setFechaStr(parseFecha(fechaStr)) : undefined}
                  />
                </View>
              ))}

              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>Descripción</Text>
                <TextInput
                  style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0", minHeight: 80, textAlignVertical: "top" }}
                  placeholder="Describe el evento..." placeholderTextColor="#9ca3af"
                  multiline value={descripcion} onChangeText={setDescripcion}
                />
              </View>

              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 8 }}>Categoría</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {CATS.map(c => (
                    <TouchableOpacity key={c.value} onPress={() => setCategoria(c.value)}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: categoria === c.value ? c.color : "#f1f3f4" }}>
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: categoria === c.value ? "#fff" : "#6c757d" }}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
