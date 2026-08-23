import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { Colors } from "@/constants/colors";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  ayuntamiento: "Ayuntamiento",
  asociacion: "Asociación",
  empresa: "Empresa",
  ciudadano: "Ciudadano",
};

const ROLE_COLOR: Record<string, string> = {
  admin: "#FF3B30",
  ayuntamiento: Colors.primary,
  asociacion: "#AF52DE",
  empresa: "#34C759",
  ciudadano: Colors.textLight,
};

function MenuSection({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 10, borderRadius: 14,
      backgroundColor: Colors.card, overflow: "hidden",
      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 }, elevation: 1,
    }}>
      {children}
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger, value }: {
  icon: string; label: string; onPress: () => void; danger?: boolean; value?: string;
}) {
  const color = danger ? Colors.danger : Colors.textPrimary;
  const iconColor = danger ? Colors.danger : Colors.textSecondary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: Colors.separator }}
    >
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: iconColor + "18", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 16, color }}>{label}</Text>
      {value
        ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textLight, marginRight: 6 }}>{value}</Text>
        : null}
      {!danger && <Ionicons name="chevron-forward" size={15} color={Colors.textPlaceholder} />}
    </TouchableOpacity>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  if (!user || !profile) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface, paddingHorizontal: 32 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Ionicons name="person-outline" size={44} color={Colors.textLight} />
        </View>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.textPrimary, letterSpacing: -0.4, textAlign: "center" }}>
          Accede a tu cuenta
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textSecondary, textAlign: "center", marginTop: 10, lineHeight: 22 }}>
          Inicia sesión para reportar incidencias, recibir notificaciones y más.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/auth")}
          activeOpacity={0.85}
          style={{ marginTop: 28, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 48, alignSelf: "stretch", alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const inicial = profile.nombre.charAt(0).toUpperCase();
  const roleColor = ROLE_COLOR[profile.role] ?? Colors.textLight;

  const handleSignOut = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.surface }}>
      {/* Header perfil */}
      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, alignItems: "center" }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" }}>
          <Text style={{ color: "#fff", fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -1 }}>{inicial}</Text>
        </View>
        <Text style={{ color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.5 }}>
          {profile.nombre} {profile.apellidos}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 3 }}>
          {profile.email}
        </Text>
        {profile.role !== "ciudadano" && (
          <View style={{ marginTop: 10, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }}>
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
              {ROLE_LABEL[profile.role] ?? profile.role}
            </Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: -20 }}>
        {/* Cuenta */}
        <MenuSection>
          <MenuItem icon="person-outline" label="Editar perfil" onPress={() => {}} />
          <MenuItem icon="notifications-outline" label="Notificaciones" onPress={() => {}} />
          <MenuItem
            icon="warning-outline"
            label="Mis incidencias"
            onPress={() => router.push("/(tabs)/incidencias" as any)}
          />
          {profile.role === "empresa" && (
            <MenuItem
              icon="briefcase-outline"
              label="Mi empresa"
              onPress={() => router.push("/mi-empresa" as any)}
            />
          )}
          {["ayuntamiento", "admin", "asociacion"].includes(profile.role) && (
            <MenuItem
              icon="newspaper-outline"
              label="Publicar noticia"
              onPress={() => router.push("/noticia/nueva" as any)}
            />
          )}
        </MenuSection>

        {/* Información */}
        <MenuSection>
          <MenuItem
            icon="information-circle-outline"
            label="Versión de la app"
            onPress={() => {}}
            value="1.0.0"
          />
          <MenuItem
            icon="mail-outline"
            label="Contactar con el Ayuntamiento"
            onPress={() => {}}
          />
        </MenuSection>

        {/* Sesión */}
        <MenuSection>
          <MenuItem
            icon="log-out-outline"
            label="Cerrar sesión"
            onPress={handleSignOut}
            danger
          />
        </MenuSection>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}
