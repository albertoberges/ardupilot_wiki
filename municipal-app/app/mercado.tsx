import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/hooks/useAuth";
import {
  useAnuncios,
  useAnunciosMios,
  crearAnuncio,
  actualizarAnuncio,
  eliminarAnuncio,
  Anuncio,
  CategoriaAnuncio,
} from "@/hooks/useMercado";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

type Tab = "comprar" | "mis";

const CATS: CategoriaAnuncio[] = [
  "electronica", "ropa", "hogar", "deporte",
  "motor", "libros", "juguetes", "otros",
];

const CAT_LABEL: Record<CategoriaAnuncio, string> = {
  electronica: "Electrónica",
  ropa: "Ropa",
  hogar: "Hogar",
  deporte: "Deporte",
  motor: "Motor",
  libros: "Libros",
  juguetes: "Juguetes",
  otros: "Otros",
};

const CAT_ICON: Record<CategoriaAnuncio, string> = {
  electronica: "phone-portrait",
  ropa: "shirt",
  hogar: "home",
  deporte: "football",
  motor: "car",
  libros: "book",
  juguetes: "game-controller",
  otros: "cube",
};

const CAT_COLOR: Record<CategoriaAnuncio, string> = {
  electronica: "#2471a3",
  ropa: "#8e44ad",
  hogar: "#e67e22",
  deporte: "#16a085",
  motor: "#c0392b",
  libros: "#d4a017",
  juguetes: "#e74c3c",
  otros: "#7f8c8d",
};

async function subirImagen(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = uri.split(".").pop() ?? "jpg";
  const fileName = `mercado/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("public")
    .upload(fileName, blob, { contentType: `image/${ext}` });
  if (error) throw error;
  const { data } = supabase.storage.from("public").getPublicUrl(fileName);
  return data.publicUrl;
}

export default function MercadoScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("comprar");
  const [catFiltro, setCatFiltro] = useState<CategoriaAnuncio | undefined>(undefined);
  const [busqueda, setBusqueda] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Campos del formulario
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [negociable, setNegociable] = useState(false);
  const [gratis, setGratis] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaAnuncio>("otros");
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [imagenUrlActual, setImagenUrlActual] = useState<string | null>(null);

  const { anuncios, loading, refreshing, refresh } = useAnuncios(tab === "comprar" ? catFiltro : undefined);
  const { anuncios: mios, loading: loadingMios, refresh: refreshMios } = useAnunciosMios(user?.id ?? "");

  const anunciosFiltrados = busqueda.trim()
    ? anuncios.filter(
        (a) =>
          a.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
          a.descripcion.toLowerCase().includes(busqueda.toLowerCase())
      )
    : anuncios;

  function resetForm() {
    setTitulo("");
    setDescripcion("");
    setPrecio("");
    setNegociable(false);
    setGratis(false);
    setCategoria("otros");
    setImagenUri(null);
    setImagenUrlActual(null);
    setEditandoId(null);
  }

  function abrirModalNuevo() {
    resetForm();
    setModalVisible(true);
  }

  function abrirModalEditar(a: Anuncio) {
    setEditandoId(a.id);
    setTitulo(a.titulo);
    setDescripcion(a.descripcion);
    setPrecio(a.precio ? String(a.precio) : "");
    setNegociable(a.precio_negociable);
    setGratis(a.gratis);
    setCategoria(a.categoria);
    setImagenUri(null);
    setImagenUrlActual(a.imagen_url ?? null);
    setModalVisible(true);
  }

  async function seleccionarFoto() {
    Alert.alert("Añadir foto", "¿Desde dónde quieres subir la imagen?", [
      {
        text: "Galería",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permiso denegado", "Necesitas permitir el acceso a la galería."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.75,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled && result.assets[0]) setImagenUri(result.assets[0].uri);
        },
      },
      {
        text: "Cámara",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permiso denegado", "Necesitas permitir el acceso a la cámara."); return; }
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.75,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled && result.assets[0]) setImagenUri(result.assets[0].uri);
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function publicar() {
    if (!titulo.trim() || !descripcion.trim()) {
      Alert.alert("Campos obligatorios", "El título y la descripción son obligatorios.");
      return;
    }
    if (!user) { Alert.alert("Inicia sesión", "Debes estar autenticado para publicar."); return; }
    setGuardando(true);
    try {
      let imagen_url = imagenUrlActual ?? undefined;
      if (imagenUri) imagen_url = await subirImagen(imagenUri);

      const payload = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        precio: gratis ? undefined : precio.trim() ? parseFloat(precio) : undefined,
        precio_negociable: negociable,
        gratis,
        categoria,
        imagen_url,
      };

      if (editandoId) {
        await actualizarAnuncio(editandoId, payload);
      } else {
        await crearAnuncio({ ...payload, vendedor_id: user.id });
      }

      setModalVisible(false);
      resetForm();
      refresh();
      refreshMios();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "No se pudo publicar el anuncio.");
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id: string) {
    Alert.alert("Eliminar anuncio", "¿Seguro que quieres eliminar este anuncio?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarAnuncio(id);
            refreshMios();
            refresh();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  }

  function renderAnuncioCard({ item }: { item: Anuncio }) {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/anuncio/${item.id}` as any)}
        style={{
          flex: 1,
          margin: 6,
          backgroundColor: "#fff",
          borderRadius: 12,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        {item.imagen_url ? (
          <Image source={{ uri: item.imagen_url }} style={{ width: "100%", height: 130, backgroundColor: "#f0f0f0" }} resizeMode="cover" />
        ) : (
          <View style={{ width: "100%", height: 130, backgroundColor: CAT_COLOR[item.categoria] + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={CAT_ICON[item.categoria] as any} size={40} color={CAT_COLOR[item.categoria]} />
          </View>
        )}
        <View style={{ padding: 10 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#1a202c" }} numberOfLines={2}>
            {item.titulo}
          </Text>
          <Text style={{ marginTop: 4, fontFamily: "Inter_700Bold", fontSize: 15, color: item.gratis ? "#27ae60" : Colors.primary }}>
            {item.gratis ? "Gratis" : item.precio ? `${item.precio.toFixed(2)} €` : "A convenir"}
          </Text>
          {item.precio_negociable && !item.gratis && (
            <Text style={{ fontSize: 11, color: "#6c757d", fontFamily: "Inter_400Regular" }}>Negociable</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderMioCard({ item }: { item: Anuncio }) {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/anuncio/${item.id}` as any)}
        style={{
          backgroundColor: "#fff",
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 12,
          flexDirection: "row",
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        {item.imagen_url ? (
          <Image source={{ uri: item.imagen_url }} style={{ width: 80, height: 80 }} resizeMode="cover" />
        ) : (
          <View style={{ width: 80, height: 80, backgroundColor: CAT_COLOR[item.categoria] + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={CAT_ICON[item.categoria] as any} size={28} color={CAT_COLOR[item.categoria]} />
          </View>
        )}
        <View style={{ flex: 1, padding: 10 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#1a202c" }} numberOfLines={1}>
            {item.titulo}
          </Text>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: item.gratis ? "#27ae60" : Colors.primary, marginTop: 2 }}>
            {item.gratis ? "Gratis" : item.precio ? `${item.precio.toFixed(2)} €` : "A convenir"}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => abrirModalEditar(item)}
              style={{ flex: 1, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 6, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleEliminar(item.id)}
              style={{ flex: 1, backgroundColor: "#e74c3c", borderRadius: 8, paddingVertical: 6, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const fotoPreview = imagenUri ?? imagenUrlActual;

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      {/* Tabs */}
      <View style={{ flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
        {(["comprar", "mis"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 14,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: tab === t ? Colors.primary : "transparent",
            }}
          >
            <Text style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: tab === t ? Colors.primary : "#6c757d",
            }}>
              {t === "comprar" ? "Comprar" : "Mis anuncios"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "comprar" ? (
        <>
          {/* Buscador */}
          <View style={{ backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f1f3f4", borderRadius: 10, paddingHorizontal: 10 }}>
              <Ionicons name="search" size={18} color="#9ca3af" />
              <TextInput
                style={{ flex: 1, paddingVertical: 8, paddingLeft: 6, fontSize: 14, fontFamily: "Inter_400Regular", color: "#1a202c" }}
                placeholder="Buscar en el mercado..."
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

          {/* Filtros de categoría */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0", maxHeight: 50 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => setCatFiltro(undefined)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 5,
                borderRadius: 20,
                backgroundColor: !catFiltro ? Colors.primary : "#f1f3f4",
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: !catFiltro ? "#fff" : "#6c757d" }}>
                Todos
              </Text>
            </TouchableOpacity>
            {CATS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCatFiltro(c === catFiltro ? undefined : c)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                  borderRadius: 20,
                  backgroundColor: catFiltro === c ? CAT_COLOR[c] : "#f1f3f4",
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: catFiltro === c ? "#fff" : "#6c757d" }}>
                  {CAT_LABEL[c]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={anunciosFiltrados}
            keyExtractor={(item) => item.id}
            renderItem={renderAnuncioCard}
            numColumns={2}
            contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
            refreshing={refreshing}
            onRefresh={refresh}
            ListEmptyComponent={
              !loading ? (
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
                  <Ionicons name="storefront-outline" size={48} color="#d1d5db" />
                  <Text style={{ color: "#9ca3af", fontSize: 15, marginTop: 12 }}>
                    {busqueda ? "Sin resultados" : "No hay anuncios"}
                  </Text>
                </View>
              ) : null
            }
          />
        </>
      ) : (
        <FlatList
          data={mios}
          keyExtractor={(item) => item.id}
          renderItem={renderMioCard}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
          refreshing={loadingMios}
          onRefresh={refreshMios}
          ListEmptyComponent={
            !loadingMios ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
                <Ionicons name="megaphone-outline" size={48} color="#d1d5db" />
                <Text style={{ color: "#9ca3af", fontSize: 15, marginTop: 12 }}>
                  Aún no tienes anuncios
                </Text>
                <TouchableOpacity
                  onPress={abrirModalNuevo}
                  style={{ marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}
                >
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Publicar primer anuncio</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* FAB */}
      {user && (
        <TouchableOpacity
          onPress={abrirModalNuevo}
          style={{
            position: "absolute",
            bottom: 24,
            right: 20,
            backgroundColor: Colors.primary,
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 6,
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal crear/editar */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
            {/* Header modal */}
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: Colors.primary,
              paddingTop: 56,
              paddingBottom: 16,
              paddingHorizontal: 16,
            }}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 18 }}>
                {editandoId ? "Editar anuncio" : "Nuevo anuncio"}
              </Text>
              <TouchableOpacity onPress={publicar} disabled={guardando}>
                {guardando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Publicar</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Foto */}
              <TouchableOpacity
                onPress={seleccionarFoto}
                style={{
                  height: 160,
                  borderRadius: 12,
                  borderWidth: fotoPreview ? 0 : 2,
                  borderColor: "#cbd5e0",
                  borderStyle: "dashed",
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: fotoPreview ? undefined : "#fff",
                }}
              >
                {fotoPreview ? (
                  <Image source={{ uri: fotoPreview }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Ionicons name="camera" size={36} color="#9ca3af" />
                    <Text style={{ color: "#9ca3af", marginTop: 8, fontFamily: "Inter_400Regular" }}>
                      Añadir foto (opcional)
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Título */}
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>
                  Título *
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 15,
                    fontFamily: "Inter_400Regular",
                    color: "#1a202c",
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                  }}
                  placeholder="¿Qué vendes?"
                  placeholderTextColor="#9ca3af"
                  value={titulo}
                  onChangeText={setTitulo}
                />
              </View>

              {/* Descripción */}
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>
                  Descripción *
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 15,
                    fontFamily: "Inter_400Regular",
                    color: "#1a202c",
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                    minHeight: 100,
                    textAlignVertical: "top",
                  }}
                  placeholder="Describe el artículo, estado, etc."
                  placeholderTextColor="#9ca3af"
                  multiline
                  value={descripcion}
                  onChangeText={setDescripcion}
                />
              </View>

              {/* Precio */}
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>
                  Precio
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity
                    onPress={() => { setGratis(!gratis); if (!gratis) setPrecio(""); }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: gratis ? "#27ae60" : "#f1f3f4",
                    }}
                  >
                    <Ionicons name={gratis ? "checkbox" : "square-outline"} size={18} color={gratis ? "#fff" : "#6c757d"} />
                    <Text style={{ fontFamily: "Inter_500Medium", color: gratis ? "#fff" : "#6c757d", fontSize: 14 }}>
                      Gratis
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setNegociable(!negociable)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: negociable ? Colors.primary : "#f1f3f4",
                    }}
                  >
                    <Ionicons name={negociable ? "checkbox" : "square-outline"} size={18} color={negociable ? "#fff" : "#6c757d"} />
                    <Text style={{ fontFamily: "Inter_500Medium", color: negociable ? "#fff" : "#6c757d", fontSize: 14 }}>
                      Negociable
                    </Text>
                  </TouchableOpacity>
                </View>
                {!gratis && (
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12 }}>
                    <TextInput
                      style={{ flex: 1, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular", color: "#1a202c" }}
                      placeholder="0.00"
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                      value={precio}
                      onChangeText={setPrecio}
                    />
                    <Text style={{ color: "#6c757d", fontFamily: "Inter_500Medium" }}>€</Text>
                  </View>
                )}
              </View>

              {/* Categoría */}
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 8 }}>
                  Categoría
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {CATS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setCategoria(c)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 20,
                        backgroundColor: categoria === c ? CAT_COLOR[c] : "#f1f3f4",
                      }}
                    >
                      <Ionicons name={CAT_ICON[c] as any} size={14} color={categoria === c ? "#fff" : CAT_COLOR[c]} />
                      <Text style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 13,
                        color: categoria === c ? "#fff" : "#6c757d",
                      }}>
                        {CAT_LABEL[c]}
                      </Text>
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
