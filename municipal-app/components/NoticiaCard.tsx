import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { Noticia } from "@/lib/types";
import { CategoryLabels } from "@/lib/labels";
import { CategoryColors, Colors } from "@/constants/colors";
import { formatDate } from "@/lib/utils";

interface NoticiaCardProps {
  noticia: Noticia;
  destacada?: boolean;
}

function CategoryBadge({ categoria }: { categoria: string }) {
  const color = CategoryColors[categoria] ?? Colors.textLight;
  const label = CategoryLabels.noticia?.[categoria as keyof typeof CategoryLabels.noticia] ?? categoria;
  return (
    <View style={{ backgroundColor: color + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}

export function NoticiaCard({ noticia, destacada = false }: NoticiaCardProps) {
  const router = useRouter();
  const catColor = CategoryColors[noticia.categoria] ?? Colors.textLight;

  if (destacada) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push(`/noticia/${noticia.id}`)}
        style={{
          marginHorizontal: 16, marginBottom: 12, borderRadius: 18,
          backgroundColor: Colors.card, overflow: "hidden",
          shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 }, elevation: 3,
        }}
      >
        {noticia.imagen_url
          ? <Image source={{ uri: noticia.imagen_url }} style={{ width: "100%", height: 200 }} resizeMode="cover" />
          : <View style={{ width: "100%", height: 140, backgroundColor: catColor + "18", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: catColor + "30", alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: catColor }} />
              </View>
            </View>}
        <View style={{ padding: 16 }}>
          <CategoryBadge categoria={noticia.categoria} />
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginTop: 8, lineHeight: 24, letterSpacing: -0.3 }}>
            {noticia.titulo}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 6, lineHeight: 20 }} numberOfLines={2}>
            {noticia.resumen}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 10 }}>
            {formatDate(noticia.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => router.push(`/noticia/${noticia.id}`)}
      style={{
        marginHorizontal: 16, marginBottom: 10, borderRadius: 14,
        backgroundColor: Colors.card, overflow: "hidden", flexDirection: "row",
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: 2,
        borderLeftWidth: 3, borderLeftColor: catColor,
      }}
    >
      {noticia.imagen_url && (
        <Image source={{ uri: noticia.imagen_url }} style={{ width: 88, height: 88 }} resizeMode="cover" />
      )}
      <View style={{ flex: 1, padding: 12, justifyContent: "space-between" }}>
        <View>
          <CategoryBadge categoria={noticia.categoria} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginTop: 6, lineHeight: 19, letterSpacing: -0.1 }} numberOfLines={2}>
            {noticia.titulo}
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight }}>
          {formatDate(noticia.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
