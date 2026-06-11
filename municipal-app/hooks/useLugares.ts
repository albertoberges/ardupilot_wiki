import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Lugar } from "@/lib/types";

export function useLugares() {
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("lugares_interes")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        setLugares(data ?? []);
        setLoading(false);
      });
  }, []);

  return { lugares, loading };
}
