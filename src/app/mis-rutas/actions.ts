"use server";

import { revalidatePath } from "next/cache";
import { getPedidosPorParesHojaPedido } from "@/lib/hoja-ruta";
import { createClient } from "@/lib/supabase/server";
import { esGestor, getCurrentProfile } from "@/lib/supabase/profile";

/** Separador para la clave compuesta "noHojaRuta::noPedido" usada en checkboxes/selects. */
const SEPARADOR = "::";

type Seleccion = { noHojaRuta: string; noPedido: string; clave: string };

function parsearSeleccion(valor: string): Seleccion | null {
  const idx = valor.indexOf(SEPARADOR);
  if (idx === -1) return null;
  const noHojaRuta = valor.slice(0, idx);
  const noPedido = valor.slice(idx + SEPARADOR.length);
  if (!noHojaRuta || !noPedido) return null;
  return { noHojaRuta, noPedido, clave: valor };
}

export async function confirmarEntregas(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("No autorizado");
  }

  const incidenciaGrupal = (formData.get("incidenciaGrupal") as string) || "";
  const comentario = (formData.get("comentario") as string) || null;
  const seleccionados = (formData.getAll("pedidos") as string[])
    .map(parsearSeleccion)
    .filter((s): s is Seleccion => s !== null);

  if (seleccionados.length === 0) return;

  const supabase = await createClient();
  const hojasDistintas = [...new Set(seleccionados.map((s) => s.noHojaRuta))];
  const pedidosDistintos = [...new Set(seleccionados.map((s) => s.noPedido))];

  if (!esGestor(profile.role)) {
    const { data: asignaciones } = await supabase
      .from("hoja_ruta_asignaciones")
      .select("no_hoja_ruta")
      .eq("transportista_user_id", profile.id)
      .eq("activo", true)
      .in("no_hoja_ruta", hojasDistintas);
    const hojasAsignadas = new Set(
      (asignaciones ?? []).map((a) => a.no_hoja_ruta as string)
    );
    const noAsignada = hojasDistintas.find((h) => !hojasAsignadas.has(h));
    if (noAsignada) {
      throw new Error(
        `La hoja de ruta ${noAsignada} no está asignada a tu usuario`
      );
    }
  }

  const [pedidosInfo, { data: existentes }] = await Promise.all([
    getPedidosPorParesHojaPedido(
      seleccionados.map(({ noHojaRuta, noPedido }) => ({
        noHojaRuta,
        noPedido,
      }))
    ),
    supabase
      .from("entregas_pedido")
      .select("no_hoja_ruta, no_pedido, registrado_por")
      .in("no_hoja_ruta", hojasDistintas)
      .in("no_pedido", pedidosDistintos),
  ]);

  const infoPorClave = new Map(
    pedidosInfo.map((p) => [`${p.noHojaRuta}${SEPARADOR}${p.noPedido}`, p])
  );
  const seleccionadosPorClave = new Set(seleccionados.map((s) => s.clave));
  const existentePorClave = new Map(
    (existentes ?? [])
      .map((e) => ({
        clave: `${e.no_hoja_ruta}${SEPARADOR}${e.no_pedido}`,
        registradoPor: e.registrado_por as string,
      }))
      .filter((e) => seleccionadosPorClave.has(e.clave))
      .map((e) => [e.clave, e.registradoPor])
  );

  const ahora = new Date().toISOString();

  for (const { noHojaRuta, noPedido, clave } of seleccionados) {
    const incidenciaId =
      (formData.get(`incidencia_${clave}`) as string) || incidenciaGrupal;
    if (!incidenciaId) continue;

    const info = infoPorClave.get(clave);
    const registradoPorOriginal = existentePorClave.get(clave);
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

  revalidatePath("/mis-rutas");
}
