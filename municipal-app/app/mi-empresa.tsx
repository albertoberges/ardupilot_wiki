import { useState, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Empresa } from "@/hooks/useEmpresas";
import { Colors } from "@/constants/colors";

export default function MiEmpresaScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [serviciosStr, setServiciosStr] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [web, setWeb] = useState("");
  const [direccion, setDireccion] = useState("");
  const [horario, setHorario] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("empresas").select("*").eq("nombre", profile?.nombre_organizacion ?? "").maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEmpresa(data);
          setNombre(data.nombre);
          setDescripcion(data.descripcion ?? "");
          setCategoria(data.categoria ?? "");
          setServiciosStr((data.servicios ?? []).join(", "));
          setTelefono(data.telefono ?? "");
          setEmail(data.email ?? "");
          setWeb(data.web ?? "");
          setDireccion(data.direccion ?? "");
          setHorario(data.horario ?? "");
        } else {
          setNombre(profile?.nombre_organizacion ?? "");
          setEditando(true);
        }
        setCargando(false);
      });
  }, [user]);

  async function guardar() {
    if (!nombre.trim()) { Alert.alert("Falta el nombre"); return; }
    setGuardando(true);
    const payload = {
      nombre: nombre.trim(), descripcion: descripcion.trim(),
      categoria: categoria.trim(),
      servicios: serviciosStr.split(",").map(s => s.trim()).filter(Boolean),
      telefono: telefono.trim(), email: email.trim(),
      web: web.trim(), direccion: direccion.trim(), horario: horario.trim(),
      activo: true,
    };
    try {
      if (empresa) {
        await supabase.from("empresas").update(payload).eq("id", empresa.id);
      } else {
        const { data, error } = await supabase.from("empresas").insert(payload).select().single();
        if (error) throw error;
        setEmpresa(data);
      }
      setEditando(false);
      Alert.alert("Guardado", "El perfil de tu empresa ha sido actualizado.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setGuardando(false); }
  }

  if (cargando) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 18 }}>Mi empresa</Text>
          {editando
            ? <TouchableOpacity onPress={guardar} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Guardar</Text>}
              </TouchableOpacity>
            : <TouchableOpacity onPress={() => setEditando(true)}>
                <Ionicons name="pencil" size={22} color="#fff" />
              </TouchableOpacity>
          }
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {!editando && empresa ? (
            // Vista de perfil
            <>
              <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 20, alignItems: "center" }}>
                <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Text style={{ color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" }}>{empresa.nombre.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 20, color: "#1a202c", textAlign: "center" }}>{empresa.nombre}</Text>
                {empresa.categoria ? <Text style={{ color: "#6c757d", fontSize: 13, marginTop: 4 }}>{empresa.categoria}</Text> : null}
                {empresa.descripcion ? <Text style={{ color: "#4a5568", fontSize: 14, marginTop: 10, textAlign: "center", lineHeight: 20 }}>{empresa.descripcion}</Text> : null}
              </View>

              {empresa.servicios?.length > 0 && (
                <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#1a202c", marginBottom: 10 }}>Servicios</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {empresa.servicios.map((s, i) => (
                      <View key={i} style={{ backgroundColor: Colors.primary + "15", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                        <Text style={{ fontSize: 13, color: Colors.primary, fontFamily: "Inter_500Medium" }}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {(empresa.telefono || empresa.email || empresa.web || empresa.direccion || empresa.horario) && (
                <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 10 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#1a202c", marginBottom: 2 }}>Contacto</Text>
                  {[
                    { icon: "call-outline", val: empresa.telefono },
                    { icon: "mail-outline", val: empresa.email },
                    { icon: "globe-outline", val: empresa.web },
                    { icon: "location-outline", val: empresa.direccion },
                    { icon: "time-outline", val: empresa.horario },
                  ].filter(x => x.val).map(({ icon, val }) => (
                    <View key={icon} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name={icon as any} size={16} color="#9ca3af" />
                      <Text style={{ color: "#4a5568", fontSize: 14 }}>{val}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            // Formulario edición
            <>
              {[
                { label: "Nombre de la empresa *", value: nombre, set: setNombre, placeholder: "Nombre visible" },
                { label: "Categoría", value: categoria, set: setCategoria, placeholder: "Ej: Panadería, Fontanero..." },
                { label: "Servicios (separados por comas)", value: serviciosStr, set: setServiciosStr, placeholder: "Reparaciones, Instalaciones..." },
                { label: "Teléfono", value: telefono, set: setTelefono, placeholder: "+34 000 000 000", keyboard: "phone-pad" },
                { label: "Email", value: email, set: setEmail, placeholder: "empresa@email.com", keyboard: "email-address" },
                { label: "Página web", value: web, set: setWeb, placeholder: "https://miempresa.es", keyboard: "url" },
                { label: "Dirección", value: direccion, set: setDireccion, placeholder: "Calle, número..." },
                { label: "Horario", value: horario, set: setHorario, placeholder: "L-V 9:00-14:00" },
              ].map(({ label, value, set, placeholder, keyboard }) => (
                <View key={label}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>{label}</Text>
                  <TextInput
                    style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0" }}
                    placeholder={placeholder} placeholderTextColor="#9ca3af"
                    value={value} onChangeText={set}
                    keyboardType={keyboard as any ?? "default"}
                    autoCapitalize="none"
                  />
                </View>
              ))}

              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>Descripción</Text>
                <TextInput
                  style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0", minHeight: 100, textAlignVertical: "top" }}
                  placeholder="Describe tu empresa y lo que ofreces..." placeholderTextColor="#9ca3af"
                  multiline value={descripcion} onChangeText={setDescripcion}
                />
              </View>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
