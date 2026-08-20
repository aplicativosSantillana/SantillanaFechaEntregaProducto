import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "jefe_bodega" | "transportista";

export type Profile = {
  id: string;
  role: Role;
  nombre: string;
};

/** Perfil (rol + nombre) del usuario autenticado actual, o null si no hay sesión o no tiene perfil creado. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, nombre")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

export function esGestor(role: Role): boolean {
  return role === "admin" || role === "jefe_bodega";
}
