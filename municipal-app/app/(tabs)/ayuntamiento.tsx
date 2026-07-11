import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Linking,
  Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useConfiguracion } from "@/hooks/useConfiguracion";
import { Colors } from "@/constants/colors";

function Fila({ icon, titulo, descripcion, onPress, color }: {
  icon: string; titulo: string; descripcion: string; onPress: () => void; color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
      activeOpacity={0.7}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (color ?? Colors.primary) + "15", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
        <Ionicons name={icon as any} size={22} color={color ?? Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827" }}>{titulo}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2, fontFamily: "Inter_400Regular" }}>{descripcion}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6b7280", marginBottom: 10, marginTop: 16, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {text}
    </Text>
  );
}

function Campo({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 5 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0" }}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function AyuntamientoScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { config, actualizarConfig } = useConfiguracion();
  const esAdmin = profile?.role === "admin" || profile?.role === "ayuntamiento";

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tel, setTel] = useState("");
  const [mail, setMail] = useState("");
  const [web, setWeb] = useState("");
  const [dir, setDir] = useState("");
  const [horManana, setHorManana] = useState("");
  const [horTarde, setHorTarde] = useState("");

  function abrirEditar() {
    setTel(config.telefono);
    setMail(config.email);
    setWeb(config.web);
    setDir(config.direccion);
    setHorManana(config.horario_manana);
    setHorTarde(config.horario_tarde);
    setEditando(true);
  }

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarConfig({
        telefono: tel.trim(), email: mail.trim(), web: web.trim(),
        direccion: dir.trim(), horario_manana: horManana.trim(), horario_tarde: horTarde.trim(),
      });
      setEditando(false);
      Alert.alert("Guardado", "La información ha sido actualizada.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
        <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="business" size={28} color="#fff" style={{ marginRight: 10 }} />
              <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" }}>Ayuntamiento</Text>
            </View>
            {esAdmin && (
              <TouchableOpacity onPress={abrirEditar} style={{ backgroundColor: "rgba(255,255,255,0.2)", padding: 8, borderRadius: 10 }}>
                <Ionicons name="pencil" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 }}>
            Servicios, trámites e información municipal
          </Text>
        </View>

        <View style={{ padding: 16, marginTop: -16 }}>
          {esAdmin && (
            <>
              <Label text="Panel de gestión" />
              <Fila
                icon="newspaper"
                titulo="Publicar noticia"
                descripcion="Crear una nueva noticia o aviso"
                onPress={() => router.push("/noticia/nueva" as any)}
                color="#2980b9"
              />
              <Fila
                icon="calendar"
                titulo="Crear evento"
                descripcion="Añadir un evento a la agenda"
                onPress={() => router.push("/(tabs)/agenda" as any)}
                color="#8e44ad"
              />
              <Fila
                icon="warning"
                titulo="Ver incidencias"
                descripcion="Gestionar incidencias pendientes"
                onPress={() => router.push("/(tabs)/incidencias" as any)}
                color="#e67e22"
              />
              <Fila
                icon="briefcase"
                titulo="Directorio de empresas"
                descripcion="Añadir o gestionar empresas del municipio"
                onPress={() => router.push("/empresas" as any)}
                color="#27ae60"
              />
            </>
          )}

          <Label text="Servicios" />
          <Fila
            icon="document-text-outline"
            titulo="Trámites"
            descripcion="Gestiones y solicitudes municipales"
            onPress={() => router.push("/(tabs)/tramites" as any)}
          />
          <Fila
            icon="warning-outline"
            titulo="Incidencias"
            descripcion="Reporta problemas en el municipio"
            onPress={() => router.push("/(tabs)/incidencias" as any)}
          />

          <Label text="Contacto" />
          {config.direccion ? (
            <Fila icon="location-outline" titulo="Dirección" descripcion={config.direccion} onPress={() => {}} />
          ) : null}
          <Fila icon="call-outline" titulo="Teléfono" descripcion={config.telefono} onPress={() => Linking.openURL(`tel:${config.telefono}`)} />
          <Fila icon="mail-outline" titulo="Email" descripcion={config.email} onPress={() => Linking.openURL(`mailto:${config.email}`)} />
          <Fila icon="globe-outline" titulo="Sede electrónica" descripcion={config.web} onPress={() => Linking.openURL(config.web)} />

          <Label text="Horario de atención" />
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              <Text style={{ color: "#374151", fontFamily: "Inter_500Medium", flex: 1 }}>Mañanas</Text>
              <Text style={{ color: "#6b7280", fontFamily: "Inter_400Regular", flex: 2, textAlign: "right" }}>{config.horario_manana}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: "#f3f4f6" }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              <Text style={{ color: "#374151", fontFamily: "Inter_500Medium", flex: 1 }}>Tardes</Text>
              <Text style={{ color: "#6b7280", fontFamily: "Inter_400Regular", flex: 2, textAlign: "right" }}>{config.horario_tarde}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: "#f3f4f6" }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              <Text style={{ color: "#374151", fontFamily: "Inter_500Medium", flex: 1 }}>Sáb. y festivos</Text>
              <Text style={{ color: "#ef4444", fontFamily: "Inter_400Regular", flex: 2, textAlign: "right" }}>Cerrado</Text>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      <Modal visible={editando} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 }}>
              <TouchableOpacity onPress={() => setEditando(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 18 }}>Editar información</Text>
              <TouchableOpacity onPress={guardar} disabled={guardando}>
                {guardando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Guardar</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Campo label="Teléfono" value={tel} onChangeText={setTel} />
              <Campo label="Email" value={mail} onChangeText={setMail} />
              <Campo label="Página web" value={web} onChangeText={setWeb} />
              <Campo label="Dirección" value={dir} onChangeText={setDir} />
              <Campo label="Horario mañanas" value={horManana} onChangeText={setHorManana} />
              <Campo label="Horario tardes" value={horTarde} onChangeText={setHorTarde} />
              <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: -6, marginBottom: 16 }}>
                Ej: "Lunes - Viernes: 9:00 - 14:00"
              </Text>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
