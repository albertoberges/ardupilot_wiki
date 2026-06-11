import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { Colors } from "@/constants/colors";
import { UserRole } from "@/lib/types";

const ROLES: { value: UserRole; label: string; descripcion: string }[] = [
  { value: "ciudadano",     label: "Ciudadano",      descripcion: "Vecino del municipio" },
  { value: "asociacion",    label: "Asociación",     descripcion: "Asociación local" },
  { value: "empresa",       label: "Empresa",        descripcion: "Negocio local" },
  { value: "ayuntamiento",  label: "Ayuntamiento",   descripcion: "Personal municipal" },
];

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [rol, setRol] = useState<UserRole>("ciudadano");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const necesitaCodigo = rol !== "ciudadano";

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Rellena todos los campos.");
      return;
    }
    setLoading(true);
    try {
      if (modo === "login") {
        await signIn(email, password);
      } else {
        if (!nombre.trim() || !apellidos.trim()) {
          Alert.alert("Error", "El nombre y apellidos son obligatorios.");
          setLoading(false);
          return;
        }
        if (necesitaCodigo && !codigo.trim()) {
          Alert.alert("Error", "Introduce el código de acceso para este tipo de cuenta.");
          setLoading(false);
          return;
        }
        await signUp(email, password, nombre, apellidos, rol, codigo.trim() || undefined);
        Alert.alert("¡Registro completado!", "Verifica tu email para activar la cuenta.");
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Ha ocurrido un error.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      await signInWithGoogle();
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "No se pudo iniciar sesión con Google.");
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" }}>Mi Pueblo</Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 4 }}>Conecta con tu comunidad</Text>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
          <TouchableOpacity
            onPress={handleGoogle}
            disabled={loadingGoogle}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center",
              borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 12,
              paddingVertical: 14, marginBottom: 20, backgroundColor: "#fff",
              opacity: loadingGoogle ? 0.7 : 1,
            }}
          >
            {loadingGoogle ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#4285F4", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>G</Text>
                </View>
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#333" }}>Continuar con Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "#e0e0e0" }} />
            <Text style={{ marginHorizontal: 12, color: "#999", fontSize: 13 }}>o con email</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#e0e0e0" }} />
          </View>

          <View style={{ flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {(["login", "registro"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: modo === m ? "#fff" : "transparent" }}
                onPress={() => setModo(m)}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: modo === m ? Colors.primary : "#9ca3af" }}>
                  {m === "login" ? "Iniciar sesión" : "Registrarse"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {modo === "registro" && (
            <>
              <Text style={{ color: "#374151", fontFamily: "Inter_500Medium", marginBottom: 10 }}>Tipo de cuenta</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => { setRol(r.value); setCodigo(""); }}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
                      borderColor: rol === r.value ? Colors.primary : "#e5e7eb",
                      backgroundColor: rol === r.value ? Colors.primary + "10" : "#fff",
                      minWidth: "45%",
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: rol === r.value ? Colors.primary : "#6b7280" }}>
                      {r.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: rol === r.value ? Colors.primary + "aa" : "#9ca3af", marginTop: 1 }}>
                      {r.descripcion}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: "#374151", fontFamily: "Inter_500Medium", marginBottom: 6 }}>Nombre</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827" }}
                  placeholder="Tu nombre"
                  value={nombre}
                  onChangeText={setNombre}
                  autoCapitalize="words"
                />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: "#374151", fontFamily: "Inter_500Medium", marginBottom: 6 }}>Apellidos</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827" }}
                  placeholder="Tus apellidos"
                  value={apellidos}
                  onChangeText={setApellidos}
                  autoCapitalize="words"
                />
              </View>

              {necesitaCodigo && (
                <View style={{ marginBottom: 16, backgroundColor: "#fffbeb", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#fcd34d" }}>
                  <Text style={{ color: "#92400e", fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 4 }}>
                    Código de acceso requerido
                  </Text>
                  <Text style={{ color: "#92400e", fontSize: 12, marginBottom: 10, fontFamily: "Inter_400Regular" }}>
                    Las cuentas de {ROLES.find(r => r.value === rol)?.label} necesitan un código especial. Contacta con el ayuntamiento para obtenerlo.
                  </Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: "#fcd34d", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", color: "#111827" }}
                    placeholder="Introduce el código"
                    value={codigo}
                    onChangeText={setCodigo}
                    autoCapitalize="characters"
                  />
                </View>
              )}
            </>
          )}

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#374151", fontFamily: "Inter_500Medium", marginBottom: 6 }}>Email</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827" }}
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: "#374151", fontFamily: "Inter_500Medium", marginBottom: 6 }}>Contraseña</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f9fafb", color: "#111827" }}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", opacity: loading ? 0.7 : 1 }}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
              {loading ? "..." : modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ marginTop: 16, paddingVertical: 12, alignItems: "center" }} onPress={() => router.back()}>
            <Text style={{ color: "#9ca3af", fontSize: 14 }}>Continuar sin cuenta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
