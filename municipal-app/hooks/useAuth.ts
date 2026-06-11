import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Session, User } from "@supabase/supabase-js";

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/types";

WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, nombre: string, apellidos: string, role = "ciudadano", codigo?: string) {
    if (role !== "ciudadano" && codigo) {
      const { data: valid, error: codeError } = await supabase.rpc("validar_codigo", {
        p_codigo: codigo,
        p_role: role,
      });
      if (codeError || !valid) throw new Error("Código de acceso incorrecto o no válido.");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre, apellidos, role } },
    });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    const redirectUrl = Linking.createURL("/");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) { Alert.alert("Error", error.message); throw error; }
    if (!data.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === "success") {
      const fragment = result.url.split("#")[1] ?? "";
      const params = Object.fromEntries(fragment.split("&").map(p => p.split("=")));
      const access_token = params["access_token"];
      const refresh_token = params["refresh_token"];

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
      } else {
        // Fallback: try PKCE code exchange
        const { error } = await supabase.auth.exchangeCodeForSession(result.url);
        if (error) throw error;
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, user, profile, loading, signIn, signUp, signOut, signInWithGoogle };
}
