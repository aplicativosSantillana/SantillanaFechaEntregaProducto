"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esGestor, getCurrentProfile } from "@/lib/supabase/profile";

export async function asignarHojaRuta(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !esGestor(profile.role)) {
    throw new Error("No autorizado");
  }

  const noHojaRuta = formData.get("noHojaRuta") as string;
  const transportistaUserId = formData.get("transportistaUserId") as string;
  if (!noHojaRuta || !transportistaUserId) return;

  const supabase = await createClient();

  await supabase
    .from("hoja_ruta_asignaciones")
    .update({ activo: false })
    .eq("no_hoja_ruta", noHojaRuta)
    .eq("activo", true);

  await supabase.from("hoja_ruta_asignaciones").insert({
    no_hoja_ruta: noHojaRuta,
    transportista_user_id: transportistaUserId,
    asignado_por: profile.id,
  });

  revalidatePath("/asignaciones");
}

export async function desasignarHojaRuta(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !esGestor(profile.role)) {
    throw new Error("No autorizado");
  }

  const noHojaRuta = formData.get("noHojaRuta") as string;
  if (!noHojaRuta) return;

  const supabase = await createClient();

  await supabase
    .from("hoja_ruta_asignaciones")
    .update({ activo: false })
    .eq("no_hoja_ruta", noHojaRuta)
    .eq("activo", true);

  revalidatePath("/asignaciones");
}
