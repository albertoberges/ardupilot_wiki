import { useState } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { crearNoticia } from "@/hooks/useNoticias";
import { CategoriaNoticia } from "@/lib/types";
import { Colors } from "@/constants/colors";

const CATS: { value: CategoriaNoticia; label: string; color: string }[] = [
  { value: "noticia",      label: "Noticia",       color: "#2980b9" },
  { value: "aviso",        label: "Aviso",         color: "#e67e22" },
  { value: "urgente",      label: "Urgente",       color: "#e74c3c" },
  { value: "obra",         label: "Obra",          color: "#8e44ad" },
  { value: "medioambiente",label: "Medio ambiente",color: "#27ae60" },
  { value: "cultura",      label: "Cultura",       color: "#d4a017" },
  { value: "deporte",      label: "Deporte",       color: "#16a085" },
  { value: "general",      label: "General",       color: "#7f8c8d" },
];

export default function NuevaNotiiciaScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [titulo, setTitulo] = useState("");
  const [resumen, setResumen] = useState("");
  const [contenido, setContenido] = useState("");
  const [categoria, setCategoria] = useState<CategoriaNoticia>("noticia");
  const [destacada, setDestacada] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function publicar() {
    if (!titulo.trim() || !resumen.trim() || !contenido.trim()) {
      Alert.alert("Faltan datos", "Título, resumen y contenido son obligatorios.");
      return;
    }
    if (!user) { Alert.alert("Error", "Debes estar autenticado."); return; }
    setGuardando(true);
    try {
      await crearNoticia({
        titulo: titulo.trim(), resumen: resumen.trim(),
        contenido: contenido.trim(), categoria, destacada,
        autor_id: user.id,
      });
      Alert.alert("Noticia publicada", "Ya aparece en el inicio.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setGuardando(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 18 }}>Nueva noticia</Text>
          <TouchableOpacity onPress={publicar} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Publicar</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {/* Categoría */}
          <View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 8 }}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATS.map(c => (
                <TouchableOpacity key={c.value} onPress={() => setCategoria(c.value)}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: categoria === c.value ? c.color : "#f1f3f4" }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: categoria === c.value ? "#fff" : "#6c757d" }}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Destacada */}
          <TouchableOpacity
            onPress={() => setDestacada(!destacada)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: destacada ? Colors.primary : "#e2e8f0" }}
          >
            <Ionicons name={destacada ? "star" : "star-outline"} size={20} color={destacada ? Colors.primary : "#9ca3af"} />
            <Text style={{ fontFamily: "Inter_500Medium", color: destacada ? Colors.primary : "#6c757d" }}>
              Marcar como destacada
            </Text>
          </TouchableOpacity>

          {/* Título */}
          <View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>Título *</Text>
            <TextInput
              style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0" }}
              placeholder="Título de la noticia" placeholderTextColor="#9ca3af"
              value={titulo} onChangeText={setTitulo}
            />
          </View>

          {/* Resumen */}
          <View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>Resumen *</Text>
            <TextInput
              style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0", minHeight: 70, textAlignVertical: "top" }}
              placeholder="Breve descripción (aparece en la lista)" placeholderTextColor="#9ca3af"
              multiline value={resumen} onChangeText={setResumen}
            />
          </View>

          {/* Contenido */}
          <View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>Contenido completo *</Text>
            <TextInput
              style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0", minHeight: 160, textAlignVertical: "top" }}
              placeholder="Texto completo de la noticia..." placeholderTextColor="#9ca3af"
              multiline value={contenido} onChangeText={setContenido}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
