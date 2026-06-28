import { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput,
  ScrollView, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/hooks/useAuth";
import {
  useAnuncios, useAnunciosMios, crearAnuncio, actualizarAnuncio,
  eliminarAnuncio, Anuncio, CategoriaAnuncio,
} from "@/hooks/useMercado";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

type Tab = "comprar" | "mis";

const CATS: CategoriaAnuncio[] = ["electronica","ropa","hogar","deporte","motor","libros","juguetes","otros"];
const LABEL: Record<CategoriaAnuncio, string> = {
  electronica:"Electrónica", ropa:"Ropa", hogar:"Hogar", deporte:"Deporte",
  motor:"Motor", libros:"Libros", juguetes:"Juguetes", otros:"Otros",
};
const ICON: Record<CategoriaAnuncio, string> = {
  electronica:"phone-portrait", ropa:"shirt", hogar:"home", deporte:"football",
  motor:"car", libros:"book", juguetes:"game-controller", otros:"cube",
};
const COLOR: Record<CategoriaAnuncio, string> = {
  electronica:"#2471a3", ropa:"#8e44ad", hogar:"#e67e22", deporte:"#16a085",
  motor:"#c0392b", libros:"#d4a017", juguetes:"#e74c3c", otros:"#7f8c8d",
};

async function subirImagen(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const ext = uri.split(".").pop() ?? "jpg";
  const path = "mercado/" + Date.now() + "." + ext;
  const { error } = await supabase.storage.from("public").upload(path, blob, { contentType: "image/" + ext });
  if (error) throw error;
  return supabase.storage.from("public").getPublicUrl(path).data.publicUrl;
}

// ── Componentes fuera del padre para evitar bug de FlatList ──

function CardComprar({ item }: { item: Anuncio }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(("/anuncio/" + item.id) as any)}
      style={{ flex: 1, margin: 6, backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}
    >
      {item.imagen_url
        ? <Image source={{ uri: item.imagen_url }} style={{ width: "100%", height: 130 }} resizeMode="cover" />
        : <View style={{ width: "100%", height: 130, backgroundColor: COLOR[item.categoria] + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={ICON[item.categoria] as any} size={40} color={COLOR[item.categoria]} />
          </View>}
      <View style={{ padding: 10 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#1a202c" }} numberOfLines={2}>{item.titulo}</Text>
        <Text style={{ marginTop: 4, fontFamily: "Inter_700Bold", fontSize: 15, color: item.gratis ? "#27ae60" : Colors.primary }}>
          {item.gratis ? "Gratis" : item.precio ? item.precio.toFixed(2) + " €" : "A convenir"}
        </Text>
        {item.precio_negociable && !item.gratis && (
          <Text style={{ fontSize: 11, color: "#9ca3af" }}>Negociable</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function CardMio({ item, onEdit, onDelete }: { item: Anuncio; onEdit: () => void; onDelete: () => void }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(("/anuncio/" + item.id) as any)}
      style={{ backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, flexDirection: "row", overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}
    >
      {item.imagen_url
        ? <Image source={{ uri: item.imagen_url }} style={{ width: 80, height: 80 }} resizeMode="cover" />
        : <View style={{ width: 80, height: 80, backgroundColor: COLOR[item.categoria] + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={ICON[item.categoria] as any} size={28} color={COLOR[item.categoria]} />
          </View>}
      <View style={{ flex: 1, padding: 10 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#1a202c" }} numberOfLines={1}>{item.titulo}</Text>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: item.gratis ? "#27ae60" : Colors.primary, marginTop: 2 }}>
          {item.gratis ? "Gratis" : item.precio ? item.precio.toFixed(2) + " €" : "A convenir"}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TouchableOpacity onPress={onEdit} style={{ flex: 1, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={{ flex: 1, backgroundColor: "#e74c3c", borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Pantalla principal ──

export default function MercadoScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("comprar");
  const [catFiltro, setCatFiltro] = useState<CategoriaAnuncio | undefined>(undefined);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [negociable, setNegociable] = useState(false);
  const [gratis, setGratis] = useState(false);
  const [cat, setCat] = useState<CategoriaAnuncio>("otros");
  const [imgUri, setImgUri] = useState<string | null>(null);
  const [imgUrlActual, setImgUrlActual] = useState<string | null>(null);

  const { anuncios, loading, refreshing, refresh } = useAnuncios(tab === "comprar" ? catFiltro : undefined);
  const { anuncios: mios, loading: loadMios, refresh: refreshMios } = useAnunciosMios(user?.id ?? "");

  const filtrados = busqueda.trim()
    ? anuncios.filter(a =>
        a.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.descripcion.toLowerCase().includes(busqueda.toLowerCase()))
    : anuncios;

  function reset() {
    setTitulo(""); setDescripcion(""); setPrecio(""); setNegociable(false);
    setGratis(false); setCat("otros"); setImgUri(null); setImgUrlActual(null); setEditId(null);
  }

  function abrirEditar(a: Anuncio) {
    setEditId(a.id); setTitulo(a.titulo); setDescripcion(a.descripcion);
    setPrecio(a.precio ? String(a.precio) : ""); setNegociable(a.precio_negociable);
    setGratis(a.gratis); setCat(a.categoria); setImgUri(null); setImgUrlActual(a.imagen_url ?? null);
    setModal(true);
  }

  async function seleccionarFoto() {
    Alert.alert("Añadir foto", "¿Desde dónde?", [
      { text: "Galería", onPress: async () => {
        const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!p.granted) { Alert.alert("Sin permiso"); return; }
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75, allowsEditing: true, aspect: [4, 3] });
        if (!r.canceled) setImgUri(r.assets[0].uri);
      }},
      { text: "Cámara", onPress: async () => {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) { Alert.alert("Sin permiso"); return; }
        const r = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: true, aspect: [4, 3] });
        if (!r.canceled) setImgUri(r.assets[0].uri);
      }},
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function publicar() {
    if (!titulo.trim() || !descripcion.trim()) {
      Alert.alert("Faltan datos", "Título y descripción son obligatorios.");
      return;
    }
    if (!user) { Alert.alert("Inicia sesión"); return; }
    setGuardando(true);
    try {
      let imagen_url = imgUrlActual ?? undefined;
      if (imgUri) imagen_url = await subirImagen(imgUri);
      const payload = {
        titulo: titulo.trim(), descripcion: descripcion.trim(),
        precio: gratis ? undefined : precio.trim() ? parseFloat(precio) : undefined,
        precio_negociable: negociable, gratis, categoria: cat, imagen_url,
      };
      if (editId) { await actualizarAnuncio(editId, payload); }
      else { await crearAnuncio({ ...payload, vendedor_id: user.id }); }
      setModal(false); reset(); refresh(); refreshMios();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setGuardando(false); }
  }

  async function handleEliminar(id: string) {
    Alert.alert("Eliminar", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => {
        try { await eliminarAnuncio(id); refreshMios(); refresh(); }
        catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  }

  const imgPreview = imgUri ?? imgUrlActual;

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      {/* Tabs */}
      <View style={{ flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
        {(["comprar", "mis"] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2, borderBottomColor: tab === t ? Colors.primary : "transparent" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: tab === t ? Colors.primary : "#6c757d" }}>
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
              <TextInput style={{ flex: 1, paddingVertical: 8, paddingLeft: 6, fontSize: 14, color: "#1a202c" }}
                placeholder="Buscar..." placeholderTextColor="#9ca3af"
                value={busqueda} onChangeText={setBusqueda} />
              {busqueda.length > 0 && (
                <TouchableOpacity onPress={() => setBusqueda("")}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filtros categoría */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0", maxHeight: 50 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
            <TouchableOpacity onPress={() => setCatFiltro(undefined)}
              style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: !catFiltro ? Colors.primary : "#f1f3f4" }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: !catFiltro ? "#fff" : "#6c757d" }}>Todos</Text>
            </TouchableOpacity>
            {CATS.map(c => (
              <TouchableOpacity key={c} onPress={() => setCatFiltro(c === catFiltro ? undefined : c)}
                style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: catFiltro === c ? COLOR[c] : "#f1f3f4" }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: catFiltro === c ? "#fff" : "#6c757d" }}>{LABEL[c]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filtrados}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <CardComprar item={item} />}
            numColumns={2}
            contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
            refreshing={refreshing}
            onRefresh={refresh}
            ListEmptyComponent={!loading ? (
              <View style={{ alignItems: "center", paddingVertical: 60 }}>
                <Ionicons name="storefront-outline" size={48} color="#d1d5db" />
                <Text style={{ color: "#9ca3af", fontSize: 15, marginTop: 12 }}>No hay anuncios</Text>
              </View>
            ) : null}
          />
        </>
      ) : (
        <FlatList
          data={mios}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CardMio
              item={item}
              onEdit={() => abrirEditar(item)}
              onDelete={() => handleEliminar(item.id)}
            />
          )}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
          ListEmptyComponent={!loadMios ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="megaphone-outline" size={48} color="#d1d5db" />
              <Text style={{ color: "#9ca3af", fontSize: 15, marginTop: 12 }}>Aún no tienes anuncios</Text>
              <TouchableOpacity onPress={() => { reset(); setModal(true); }}
                style={{ marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}>
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Publicar primer anuncio</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        />
      )}

      {/* FAB */}
      {user && (
        <TouchableOpacity onPress={() => { reset(); setModal(true); }}
          style={{ position: "absolute", bottom: 24, right: 20, backgroundColor: Colors.primary, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal crear/editar */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 }}>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 18 }}>
                {editId ? "Editar anuncio" : "Nuevo anuncio"}
              </Text>
              <TouchableOpacity onPress={publicar} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Publicar</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Foto */}
              <TouchableOpacity onPress={seleccionarFoto}
                style={{ height: 160, borderRadius: 12, borderWidth: imgPreview ? 0 : 2, borderColor: "#cbd5e0", borderStyle: "dashed", overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: imgPreview ? undefined : "#fff" }}>
                {imgPreview
                  ? <Image source={{ uri: imgPreview }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  : <View style={{ alignItems: "center" }}>
                      <Ionicons name="camera" size={36} color="#9ca3af" />
                      <Text style={{ color: "#9ca3af", marginTop: 8 }}>Añadir foto (opcional)</Text>
                    </View>}
              </TouchableOpacity>

              {/* Título */}
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>Título *</Text>
                <TextInput style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0" }}
                  placeholder="¿Qué vendes?" placeholderTextColor="#9ca3af" value={titulo} onChangeText={setTitulo} />
              </View>

              {/* Descripción */}
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>Descripción *</Text>
                <TextInput style={{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#1a202c", borderWidth: 1, borderColor: "#e2e8f0", minHeight: 100, textAlignVertical: "top" }}
                  placeholder="Describe el artículo..." placeholderTextColor="#9ca3af" multiline value={descripcion} onChangeText={setDescripcion} />
              </View>

              {/* Precio */}
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 6 }}>Precio</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity onPress={() => { setGratis(!gratis); if (!gratis) setPrecio(""); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: gratis ? "#27ae60" : "#f1f3f4" }}>
                    <Ionicons name={gratis ? "checkbox" : "square-outline"} size={18} color={gratis ? "#fff" : "#6c757d"} />
                    <Text style={{ color: gratis ? "#fff" : "#6c757d", fontSize: 14 }}>Gratis</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setNegociable(!negociable)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: negociable ? Colors.primary : "#f1f3f4" }}>
                    <Ionicons name={negociable ? "checkbox" : "square-outline"} size={18} color={negociable ? "#fff" : "#6c757d"} />
                    <Text style={{ color: negociable ? "#fff" : "#6c757d", fontSize: 14 }}>Negociable</Text>
                  </TouchableOpacity>
                </View>
                {!gratis && (
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12 }}>
                    <TextInput style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: "#1a202c" }}
                      placeholder="0.00" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" value={precio} onChangeText={setPrecio} />
                    <Text style={{ color: "#6c757d" }}>€</Text>
                  </View>
                )}
              </View>

              {/* Categoría */}
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#4a5568", marginBottom: 8 }}>Categoría</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {CATS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setCat(c)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: cat === c ? COLOR[c] : "#f1f3f4" }}>
                      <Ionicons name={ICON[c] as any} size={14} color={cat === c ? "#fff" : COLOR[c]} />
                      <Text style={{ fontSize: 13, color: cat === c ? "#fff" : "#6c757d" }}>{LABEL[c]}</Text>
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
