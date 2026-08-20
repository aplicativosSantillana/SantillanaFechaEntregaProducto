"use server";

import { revalidatePath } from "next/cache";
import { getPedidosPorNumeros } from "@/lib/hoja-ruta";
import { createClient } from "@/lib/supabase/server";
import { esGestor, getCurrentProfile } from "@/lib/supabase/profile";

export async function confirmarEntregas(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("No autorizado");
  }

  const noHojaRuta = formData.get("noHojaRuta") as string;
  const incidenciaGrupal = (formData.get("incidenciaGrupal") as string) || "";
  const comentario = (formData.get("comentario") as string) || null;
  const pedidosSeleccionados = formData.getAll("pedidos") as string[];

  if (!noHojaRuta || pedidosSeleccionados.length === 0) return;

  const supabase = await createClient();

  if (!esGestor(profile.role)) {
    const { data: asignacion } = await supabase
      .from("hoja_ruta_asignaciones")
      .select("id")
      .eq("no_hoja_ruta", noHojaRuta)
      .eq("transportista_user_id", profile.id)
      .eq("activo", true)
      .maybeSingle();
    if (!asignacion) {
      throw new Error("Esta hoja de ruta no está asignada a tu usuario");
    }
  }

  const [pedidosInfo, { data: existentes }] = await Promise.all([
    getPedidosPorNumeros(noHojaRuta, pedidosSeleccionados),
    supabase
      .from("entregas_pedido")
      .select("no_pedido, registrado_por")
      .eq("no_hoja_ruta", noHojaRuta)
      .in("no_pedido", pedidosSeleccionados),
  ]);

  const pedidosPorNumero = new Map(pedidosInfo.map((p) => [p.noPedido, p]));
  const existentesPorNumero = new Map(
    (existentes ?? []).map((e) => [
      e.no_pedido as string,
      e.registrado_por as string,
    ])
  );

  const ahora = new Date().toISOString();

  for (const noPedido of pedidosSeleccionados) {
    const incidenciaId =
      (formData.get(`incidencia_${noPedido}`) as string) || incidenciaGrupal;
    if (!incidenciaId) continue;

    const info = pedidosPorNumero.get(noPedido);
    const registradoPorOriginal = existentesPorNumero.get(noPedido);
    const esCorreccion = Boolean(registradoPorOriginal);

    const payload: Record<string, unknown> = {
      no_hoja_ruta: noHojaRuta,
      no_pedido: noPedido,
      cod_cliente: info?.codCliente ?? null,
      nombre_cliente: info?.nombreCliente ?? null,
      incidencia_id: incidenciaId,
      comentario,
      fecha_hora_entrega: ahora,
      registrado_por: registradoPorOriginal ?? profile.id,
      updated_at: ahora,
    };
    if (esCorreccion) {
      payload.corregido_por = profile.id;
      payload.corregido_en = ahora;
    }

    const { error } = await supabase
      .from("entregas_pedido")
      .upsert(payload, { onConflict: "no_hoja_ruta,no_pedido" });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/mis-rutas/${noHojaRuta}`);
}
