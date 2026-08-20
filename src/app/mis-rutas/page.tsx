import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getHojasRutaPorNumeros,
  getPedidosPorClienteEnHojas,
  type PedidoConHoja,
} from "@/lib/hoja-ruta";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { confirmarEntregas } from "./actions";
import { ListaClientes, type ClienteResumen } from "./lista-clientes";

/** Separador para la clave compuesta "noHojaRuta::noPedido" usada en checkboxes/selects. */
const SEPARADOR = "::";

type EntregaExistente = {
  incidenciaId: string;
  incidenciaNombre: string;
  fechaHoraEntrega: string;
  corregido: boolean;
};

function claveCliente(pedido: PedidoConHoja): string {
  return pedido.codCliente || pedido.nombreCliente || pedido.noPedido;
}

export default async function MisRutasPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "transportista") {
    redirect("/asignaciones");
  }

  const { cliente: clienteParam } = await searchParams;

  const supabase = await createClient();
  const { data: asignaciones } = await supabase
    .from("hoja_ruta_asignaciones")
    .select("no_hoja_ruta")
    .eq("transportista_user_id", profile.id)
    .eq("activo", true);

  const misHojasRuta = (asignaciones ?? []).map(
    (a) => a.no_hoja_ruta as string
  );

  const [hojas, pedidos, { data: incidencias }] = await Promise.all([
    getHojasRutaPorNumeros(misHojasRuta),
    getPedidosPorClienteEnHojas(misHojasRuta, ""),
    supabase
      .from("incidencias_catalogo")
      .select("id, nombre")
      .eq("activo", true)
      .order("orden"),
  ]);

  const entregaPorClave = new Map<string, EntregaExistente>();
  if (pedidos.length > 0) {
    const { data: entregas } = await supabase
      .from("entregas_pedido")
      .select(
        "no_hoja_ruta, no_pedido, incidencia_id, fecha_hora_entrega, corregido_por, incidencias_catalogo(nombre)"
      )
      .in("no_hoja_ruta", [...new Set(pedidos.map((p) => p.noHojaRuta))])
      .in(
        "no_pedido",
        pedidos.map((p) => p.noPedido)
      );

    const clavesBuscadas = new Set(
      pedidos.map((p) => `${p.noHojaRuta}${SEPARADOR}${p.noPedido}`)
    );

    for (const e of entregas ?? []) {
      const clave = `${e.no_hoja_ruta}${SEPARADOR}${e.no_pedido}`;
      if (!clavesBuscadas.has(clave)) continue;

      const incidenciaRel = e.incidencias_catalogo as unknown as
        | { nombre: string }
        | { nombre: string }[]
        | null;
      const nombre = Array.isArray(incidenciaRel)
        ? incidenciaRel[0]?.nombre
        : incidenciaRel?.nombre;
      entregaPorClave.set(clave, {
        incidenciaId: e.incidencia_id as string,
        incidenciaNombre: nombre ?? "",
        fechaHoraEntrega: e.fecha_hora_entrega as string,
        corregido: Boolean(e.corregido_por),
      });
    }
  }

  // Agrupar pedidos por cliente para la lista de selección.
  const resumenesPorCliente = new Map<
    string,
    {
      nombreCliente: string;
      codCliente: string;
      direccionEnvio: string;
      pedidos: PedidoConHoja[];
    }
  >();
  for (const pedido of pedidos) {
    const clave = claveCliente(pedido);
    const existente = resumenesPorCliente.get(clave);
    if (existente) {
      existente.pedidos.push(pedido);
    } else {
      resumenesPorCliente.set(clave, {
        nombreCliente: pedido.nombreCliente ?? "",
        codCliente: pedido.codCliente ?? "",
        direccionEnvio: pedido.direccionDeEnvio ?? "",
        pedidos: [pedido],
      });
    }
  }

  const clientes: ClienteResumen[] = [...resumenesPorCliente.entries()]
    .map(([clienteKey, r]) => ({
      clienteKey,
      nombreCliente: r.nombreCliente,
      codCliente: r.codCliente,
      direccionEnvio: r.direccionEnvio,
      totalPedidos: r.pedidos.length,
      pendientes: r.pedidos.filter(
        (p) =>
          !entregaPorClave.has(`${p.noHojaRuta}${SEPARADOR}${p.noPedido}`)
      ).length,
    }))
    .sort((a, b) =>
      (a.nombreCliente || a.codCliente).localeCompare(
        b.nombreCliente || b.codCliente
      )
    );

  const clientesPendientes = clientes.filter((c) => c.pendientes > 0);
  const clientesCompletados = clientes.filter((c) => c.pendientes === 0);

  const pedidosDelCliente = clienteParam
    ? pedidos.filter((p) => claveCliente(p) === clienteParam)
    : [];

  return (
    <div className="flex-1 bg-zinc-50 px-4 py-8 dark:bg-black">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {!clienteParam ? (
          <>
            <div>
              <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
                Mis rutas
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {hojas.length === 0
                  ? "Todavía no tienes hojas de ruta asignadas."
                  : `Tienes ${hojas.length} hoja${
                      hojas.length === 1 ? "" : "s"
                    } de ruta asignada${
                      hojas.length === 1 ? "" : "s"
                    }: ${hojas.map((h) => h.noHojaRuta).join(", ")}`}
              </p>
            </div>

            <ListaClientes
              pendientes={clientesPendientes}
              completados={clientesCompletados}
            />
          </>
        ) : (
          <>
            <div>
              <Link
                href="/mis-rutas"
                className="text-sm text-zinc-500 hover:underline"
              >
                ← Volver a la lista de clientes
              </Link>
              <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
                {pedidosDelCliente[0]?.nombreCliente || clienteParam}
              </h1>
              {pedidosDelCliente[0]?.direccionDeEnvio && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {pedidosDelCliente[0].direccionDeEnvio}
                </p>
              )}
            </div>

            {pedidosDelCliente.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No se encontraron pedidos para este cliente.
              </p>
            ) : (
              <form
                action={confirmarEntregas}
                className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
              >
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
                      <th className="py-1 font-medium">Hoja de ruta</th>
                      <th className="py-1 font-medium">Factura / Guía</th>
                      <th className="py-1 font-medium">Estado</th>
                      <th className="py-1 font-medium">
                        Incidencia individual
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosDelCliente.map((pedido) => {
                      const clave = `${pedido.noHojaRuta}${SEPARADOR}${pedido.noPedido}`;
                      const entrega = entregaPorClave.get(clave);
                      return (
                        <tr
                          key={clave}
                          className="border-t border-black/[.08] dark:border-white/[.145]"
                        >
                          <td className="py-2 align-top">
                            <input
                              type="checkbox"
                              name="pedidos"
                              value={clave}
                            />
                          </td>
                          <td className="py-2 align-top">
                            <p className="font-medium text-black dark:text-zinc-50">
                              {pedido.noPedido}
                            </p>
                          </td>
                          <td className="py-2 align-top text-zinc-700 dark:text-zinc-300">
                            {pedido.noHojaRuta}
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
                                {new Date(
                                  entrega.fechaHoraEntrega
                                ).toLocaleString("es-GT")}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-500">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="py-2 align-top">
                            <select
                              name={`incidencia_${clave}`}
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
          </>
        )}
      </div>
    </div>
  );
}
