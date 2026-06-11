import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Lugar, CategoriaLugar } from "@/lib/types";

export function useLugares() {
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLugares = useCallback(async () => {
    const { data, error } = await supabase
      .from("lugares_interes")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (!error) setLugares(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLugares(); }, [fetchLugares]);

  return { lugares, loading, refresh: fetchLugares };
}

export async function crearLugar(payload: {
  nombre: string;
  descripcion?: string;
  categoria: CategoriaLugar;
  latitud: number;
  longitud: number;
  direccion?: string;
  horario?: string;
  telefono?: string;
}) {
  const { data, error } = await supabase
    .from("lugares_interes")
    .insert({ ...payload, activo: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}
