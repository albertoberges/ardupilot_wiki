import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface ConfigMunicipal {
  id: number;
  nombre_municipio: string;
  nombre_ayuntamiento: string;
  telefono: string;
  email: string;
  web: string;
  direccion: string;
  horario_manana: string;
  horario_tarde: string;
  updated_at: string;
}

const DEFAULTS: ConfigMunicipal = {
  id: 1,
  nombre_municipio: "Villamayor de Gállego",
  nombre_ayuntamiento: "Ayuntamiento de Villamayor de Gállego",
  telefono: "+34 976 680 900",
  email: "ayuntamiento@villamayordegallego.es",
  web: "https://villamayordegallego.es",
  direccion: "Plaza de España, 1",
  horario_manana: "Lunes - Viernes: 9:00 - 14:00",
  horario_tarde: "Lunes y Miércoles: 16:00 - 19:00",
  updated_at: "",
};

export function useConfiguracion() {
  const [config, setConfig] = useState<ConfigMunicipal>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("configuracion_municipal")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function actualizarConfig(payload: Partial<Omit<ConfigMunicipal, "id" | "updated_at">>) {
    const { error } = await supabase
      .from("configuracion_municipal")
      .upsert({ id: 1, ...config, ...payload, updated_at: new Date().toISOString() });
    if (error) throw error;
    setConfig(prev => ({ ...prev, ...payload }));
  }

  return { config, loading, actualizarConfig };
}
