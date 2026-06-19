import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type CategoriaAnuncio =
  | "electronica"
  | "ropa"
  | "hogar"
  | "deporte"
  | "motor"
  | "libros"
  | "juguetes"
  | "otros";

export type EstadoAnuncio = "activo" | "reservado" | "vendido";

export interface Anuncio {
  id: string;
  titulo: string;
  descripcion: string;
  precio?: number;
  precio_negociable: boolean;
  gratis: boolean;
  categoria: CategoriaAnuncio;
  imagen_url?: string;
  vendedor_id: string;
  vendedor?: { nombre: string; apellidos: string };
  estado: EstadoAnuncio;
  created_at: string;
}

export function useAnuncios(categoria?: CategoriaAnuncio) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      let query = supabase
        .from("anuncios_mercado")
        .select("*, vendedor:profiles(nombre, apellidos)")
        .eq("estado", "activo")
        .order("created_at", { ascending: false });

      if (categoria) query = query.eq("categoria", categoria);

      const { data, error } = await query;
      if (error) throw error;
      setAnuncios(data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoria]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = () => { setRefreshing(true); fetchData(); };

  return { anuncios, loading, refreshing, refresh };
}

export function useAnuncio(id: string) {
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("anuncios_mercado")
      .select("*, vendedor:profiles(nombre, apellidos)")
      .eq("id", id)
      .single()
      .then(({ data }) => { setAnuncio(data); setLoading(false); });
  }, [id]);

  return { anuncio, loading };
}

export function useAnunciosMios(userId: string) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("anuncios_mercado")
      .select("*")
      .eq("vendedor_id", userId)
      .neq("estado", "vendido")
      .order("created_at", { ascending: false });
    if (!error) setAnuncios(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { anuncios, loading, refresh: fetchData };
}

export async function crearAnuncio(payload: {
  titulo: string;
  descripcion: string;
  precio?: number;
  precio_negociable: boolean;
  gratis: boolean;
  categoria: CategoriaAnuncio;
  vendedor_id: string;
  imagen_url?: string;
}) {
  const { data, error } = await supabase
    .from("anuncios_mercado")
    .insert({ ...payload, estado: "activo" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarAnuncio(
  id: string,
  payload: {
    titulo?: string;
    descripcion?: string;
    precio?: number;
    precio_negociable?: boolean;
    gratis?: boolean;
    categoria?: CategoriaAnuncio;
    imagen_url?: string;
    estado?: EstadoAnuncio;
  }
) {
  const { error } = await supabase
    .from("anuncios_mercado")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function eliminarAnuncio(id: string) {
  const { error } = await supabase
    .from("anuncios_mercado")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
