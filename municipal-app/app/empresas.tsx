import { useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Linking,
  RefreshControl, ActivityIndicator, Modal, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

const CAT_COLORS = ["#1a5276", "#8e44ad", "#c0392b", "#16a085", "#e67e22", "#2471a3", "#27ae60", "#d35400"];

function colorCategoria(texto: string): string {
  let h = 0;
  for (const c of texto) h = c.charCodeAt(0) + ((h << 5) - h);
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}

function Campo({ label, value, onChangeText, placeholder, multiline, keyboard }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboard?: any;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 5 }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
          fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0",
          ...(multiline ? { minHeight: 90, textAlignVertical: "top" } : {}),
        }}
        placeholder={placeholder} placeholderTextColor="#9ca3af"
        value={value} onChangeText={onChangeText}
        keyboardType={keyboard ?? "default"}
        autoCapitalize="none"
        multiline={multiline}
      />
    </View>
  );
}

export default function EmpresasScreen() {
  const { profile } = useAuth();
  const { empresas, loading, refreshing, refresh } = useEmpresas();
  const [busqueda, setBusqueda] = useState("");
  const esAdmin = profile?.role === "admin" || profile?.role === "ayuntamiento";

  // Modal crear empresa
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [serviciosStr, setServiciosStr] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [web, setWeb] = useState("");
  const [direccion, setDireccion] = useState("");
  const [horario, setHorario] = useState("");

  function resetForm() {
    setNombre(""); setCategoria(""); setDescripcion("");
    setServiciosStr(""); setTelefono(""); setEmail("");
    setWeb(""); setDireccion(""); setHorario("");
  }

  async function crearEmpresa() {
    if (!nombre.trim()) { Alert.alert("Falta el nombre de la empresa"); return; }
    setGuardando(true);
    try {
      const { error } = await supabase.from("empresas").insert({
        nombre: nombre.trim(),
        categoria: categoria.trim() || null,
        descripcion: descripcion.trim() || null,
        servicios: serviciosStr.split(",").map(s => s.trim()).filter(Boolean),
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        web: web.trim() || null,
        direccion: direccion.trim() || null,
        horario: horario.trim() || null,
        activo: true,
      });
      if (error) throw error;
      setModal(false);
      resetForm();
      refresh();
      Alert.alert("Empresa añadida", "Ya aparece en el directorio.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  }

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
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        {filtradas.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
            <Ionicons name="briefcase-outline" size={48} color="#d1d5db" />
            <Text style={{ color: "#9ca3af", fontSize: 15, marginTop: 12 }}>
              {busqueda ? "Sin resultados" : "No hay empresas registradas"}
            </Text>
            {esAdmin && !busqueda && (
              <TouchableOpacity
                onPress={() => { resetForm(); setModal(true); }}
                style={{ marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Añadir primera empresa</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtradas.map((empresa) => {
            const inicial = empresa.nombre.charAt(0).toUpperCase();
            const color = colorCategoria(empresa.nombre);

            return (
              <View
                key={empresa.id}
                style={{ backgroundColor: "#fff", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: color, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" }}>{inicial}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#1a202c" }} numberOfLines={1}>{empresa.nombre}</Text>
                    {empresa.categoria && (
                      <View style={{ marginTop: 4 }}>
                        <View style={{ backgroundColor: color + "18", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: "flex-start" }}>
                          <Text style={{ color, fontSize: 11, fontFamily: "Inter_500Medium" }}>{empresa.categoria}</Text>
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
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#9ca3af", flex: 1 }} numberOfLines={1}>{empresa.direccion}</Text>
                  </View>
                ) : null}

                {empresa.horario ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Ionicons name="time-outline" size={14} color="#9ca3af" />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#9ca3af", flex: 1 }} numberOfLines={1}>{empresa.horario}</Text>
                  </View>
                ) : null}

                {(empresa.telefono || empresa.email) && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    {empresa.telefono && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${empresa.telefono}`)}
                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 9 }}
                      >
                        <Ionicons name="call" size={16} color="#fff" />
                        <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" }}>Llamar</Text>
                      </TouchableOpacity>
                    )}
                    {empresa.email && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`mailto:${empresa.email}`)}
                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#f1f3f4", borderRadius: 10, paddingVertical: 9 }}
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
      </ScrollView>

      {/* FAB — solo admin/ayuntamiento */}
      {esAdmin && (
        <TouchableOpacity
          onPress={() => { resetForm(); setModal(true); }}
          style={{ position: "absolute", bottom: 24, right: 20, backgroundColor: Colors.primary, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal añadir empresa */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 }}>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 18 }}>Añadir empresa</Text>
              <TouchableOpacity onPress={crearEmpresa} disabled={guardando}>
                {guardando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Guardar</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Campo label="Nombre de la empresa *" value={nombre} onChangeText={setNombre} placeholder="Ej: Panadería García" />
              <Campo label="Categoría" value={categoria} onChangeText={setCategoria} placeholder="Ej: Panadería, Fontanero, Comercio..." />
              <Campo label="Descripción" value={descripcion} onChangeText={setDescripcion} placeholder="Breve descripción de la empresa..." multiline />
              <Campo label="Servicios (separados por comas)" value={serviciosStr} onChangeText={setServiciosStr} placeholder="Pan artesano, Bollería, Catering..." />
              <Campo label="Teléfono" value={telefono} onChangeText={setTelefono} placeholder="+34 000 000 000" keyboard="phone-pad" />
              <Campo label="Email" value={email} onChangeText={setEmail} placeholder="empresa@email.com" keyboard="email-address" />
              <Campo label="Página web" value={web} onChangeText={setWeb} placeholder="https://..." keyboard="url" />
              <Campo label="Dirección" value={direccion} onChangeText={setDireccion} placeholder="Calle, número..." />
              <Campo label="Horario" value={horario} onChangeText={setHorario} placeholder="L-V 9:00-14:00, 16:00-19:00" />
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
