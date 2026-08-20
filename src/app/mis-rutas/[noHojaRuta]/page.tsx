import { redirect } from "next/navigation";
import { getPedidosPorHojaYCliente } from "@/lib/hoja-ruta";
import { createClient } from "@/lib/supabase/server";
import { esGestor, getCurrentProfile } from "@/lib/supabase/profile";
import { confirmarEntregas } from "./actions";

type EntregaExistente = {
  incidenciaId: string;
  incidenciaNombre: string;
  fechaHoraEntrega: string;
  corregido: boolean;
};

export default async function HojaRutaPage({
  params,
  searchParams,
}: {
  params: Promise<{ noHojaRuta: string }>;
  searchParams: Promise<{ cliente?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { noHojaRuta } = await params;
  const { cliente } = await searchParams;
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
      redirect("/mis-rutas");
    }
  }

  const { data: incidencias } = await supabase
    .from("incidencias_catalogo")
    .select("id, nombre")
    .eq("activo", true)
    .order("orden");

  const clienteQuery = cliente?.trim() ?? "";
  const pedidos = clienteQuery
    ? await getPedidosPorHojaYCliente(noHojaRuta, clienteQuery)
    : [];

  const entregaPorPedido = new Map<string, EntregaExistente>();
  if (pedidos.length > 0) {
    const { data: entregas } = await supabase
      .from("entregas_pedido")
      .select(
        "no_pedido, incidencia_id, fecha_hora_entrega, corregido_por, incidencias_catalogo(nombre)"
      )
      .eq("no_hoja_ruta", noHojaRuta)
      .in(
        "no_pedido",
        pedidos.map((p) => p.noPedido)
      );

    for (const e of entregas ?? []) {
      const incidenciaRel = e.incidencias_catalogo as unknown as
        | { nombre: string }
        | { nombre: string }[]
        | null;
      const nombre = Array.isArray(incidenciaRel)
        ? incidenciaRel[0]?.nombre
        : incidenciaRel?.nombre;
      entregaPorPedido.set(e.no_pedido as string, {
        incidenciaId: e.incidencia_id as string,
        incidenciaNombre: nombre ?? "",
        fechaHoraEntrega: e.fecha_hora_entrega as string,
        corregido: Boolean(e.corregido_por),
      });
    }
  }

  return (
    <div className="flex-1 bg-zinc-50 px-4 py-8 dark:bg-black">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm text-zinc-500">Hoja de ruta</p>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
            {noHojaRuta}
          </h1>
        </div>

        <form className="flex items-center gap-2">
          <input
            type="text"
            name="cliente"
            defaultValue={clienteQuery}
            placeholder="Código o nombre del cliente (ej. CTE-002020)"
            className="flex-1 rounded-md border border-black/[.08] bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-400 dark:border-white/[.145] dark:bg-zinc-950 dark:text-zinc-50"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Buscar
          </button>
        </form>

        {clienteQuery && pedidos.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No se encontraron pedidos para &quot;{clienteQuery}&quot; en esta
            hoja de ruta.
          </p>
        )}

        {pedidos.length > 0 && (
          <form
            action={confirmarEntregas}
            className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
          >
            <input type="hidden" name="noHojaRuta" value={noHojaRuta} />

            <div className="flex flex-wrap items-end gap-3 border-b border-black/[.08] pb-4 dark:border-white/[.145]">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Incidencia para los pedidos marcados
                </label>
                <select
                  name="incidenciaGrupal"
                  defaultValue=""
                  className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-50"
                >
                  <option value="">— Selecciona —</option>
                  {(incidencias ?? []).map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Comentario (opcional)
                </label>
                <input
                  type="text"
                  name="comentario"
                  className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-50"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                Confirmar entrega
              </button>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="w-8 py-1"></th>
                  <th className="py-1 font-medium">Pedido</th>
                  <th className="py-1 font-medium">Factura / Guía</th>
                  <th className="py-1 font-medium">Estado</th>
                  <th className="py-1 font-medium">Incidencia individual</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => {
                  const entrega = entregaPorPedido.get(pedido.noPedido);
                  return (
                    <tr
                      key={pedido.noPedido}
                      className="border-t border-black/[.08] dark:border-white/[.145]"
                    >
                      <td className="py-2 align-top">
                        <input type="checkbox" name="pedidos" value={pedido.noPedido} />
                      </td>
                      <td className="py-2 align-top">
                        <p className="font-medium text-black dark:text-zinc-50">
                          {pedido.noPedido}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {pedido.nombreCliente}
                        </p>
                      </td>
                      <td className="py-2 align-top text-zinc-700 dark:text-zinc-300">
                        {pedido.noFactura || pedido.noGuia || "—"}
                      </td>
                      <td className="py-2 align-top">
                        {entrega ? (
                          <span className="text-xs text-emerald-700 dark:text-emerald-400">
                            Entregado: {entrega.incidenciaNombre}
                            {entrega.corregido ? " (corregido)" : ""}
                            <br />
                            {new Date(entrega.fechaHoraEntrega).toLocaleString(
                              "es-GT"
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-2 align-top">
                        <select
                          name={`incidencia_${pedido.noPedido}`}
                          defaultValue={entrega?.incidenciaId ?? ""}
                          className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs text-black outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-50"
                        >
                          <option value="">Usar la grupal</option>
                          {(incidencias ?? []).map((inc) => (
                            <option key={inc.id} value={inc.id}>
                              {inc.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </form>
        )}
      </div>
    </div>
  );
}
