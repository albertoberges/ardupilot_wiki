import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Empresa {
  id: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  servicios: string[];
  telefono?: string;
  email?: string;
  web?: string;
  direccion?: string;
  horario?: string;
  logo_url?: string;
  activo: boolean;
  created_at: string;
}

export function useEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      setEmpresas(data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = () => { setRefreshing(true); fetchData(); };

  return { empresas, loading, refreshing, refresh };
}
