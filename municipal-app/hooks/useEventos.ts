import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Evento, CategoriaEvento } from "@/lib/types";

export function useEventos(categoria?: CategoriaEvento) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      let query = supabase
        .from("eventos")
        .select("*")
        .eq("publicado", true)
        .gte("fecha_inicio", new Date().toISOString())
        .order("fecha_inicio", { ascending: true });

      if (categoria) query = query.eq("categoria", categoria);

      const { data, error } = await query;
      if (error) throw error;
      setEventos(data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoria]);

  useEffect(() => { fetch(); }, [fetch]);

  const refresh = () => { setRefreshing(true); fetch(); };

  return { eventos, loading, error, refreshing, refresh };
}

export function useEventosMes(mes: number, año: number) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const inicio = new Date(año, mes, 1).toISOString();
    const fin = new Date(año, mes + 1, 0, 23, 59, 59).toISOString();
    const { data, error } = await supabase
      .from("eventos")
      .select("*")
      .eq("publicado", true)
      .gte("fecha_inicio", inicio)
      .lte("fecha_inicio", fin)
      .order("fecha_inicio", { ascending: true });
    if (!error) setEventos(data ?? []);
    setLoading(false);
  }, [mes, año]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { eventos, loading };
}

export async function crearEvento(payload: {
  titulo: string; descripcion: string; categoria: CategoriaEvento;
  fecha_inicio: string; fecha_fin?: string; lugar: string;
  direccion?: string; precio?: number; organizador: string;
}) {
  const { data, error } = await supabase
    .from("eventos")
    .insert({ ...payload, publicado: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function useEvento(id: string) {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("eventos")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => { setEvento(data); setLoading(false); });
  }, [id]);

  return { evento, loading };
}
