import { redirect } from "next/navigation";
import { formatearFechaSql, getHojasRutaPorFecha } from "@/lib/hoja-ruta";
import { createClient } from "@/lib/supabase/server";
import { esGestor, getCurrentProfile } from "@/lib/supabase/profile";
import { asignarHojaRuta, desasignarHojaRuta } from "./actions";

/** Fecha de hoy en formato "YYYY-MM-DD", en hora local (no UTC). */
function hoyISO(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export default async function AsignacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; soloSinAsignar?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (!esGestor(profile.role)) {
    redirect("/mis-rutas");
  }

  const { fecha: fechaParam, soloSinAsignar } = await searchParams;
  const fechaISO = fechaParam ?? hoyISO();
  const filtrarSinAsignar = soloSinAsignar === "1";

  const [hojas, supabase] = await Promise.all([
    getHojasRutaPorFecha(fechaISO),
    createClient(),
  ]);

  const noHojasRuta = hojas.map((h) => h.noHojaRuta);

  const [{ data: asignaciones }, { data: transportistas }] =
    await Promise.all([
      noHojasRuta.length > 0
        ? supabase
            .from("hoja_ruta_asignaciones")
            .select("no_hoja_ruta, transportista_user_id")
            .eq("activo", true)
            .in("no_hoja_ruta", noHojasRuta)
        : Promise.resolve({ data: [] as { no_hoja_ruta: string; transportista_user_id: string }[] }),
      supabase
        .from("profiles")
        .select("id, nombre")
        .eq("role", "transportista")
        .order("nombre"),
    ]);

  const asignacionPorHoja = new Map(
    (asignaciones ?? []).map((a) => [
      a.no_hoja_ruta,
      a.transportista_user_id,
    ])
  );
  const nombrePorTransportista = new Map(
    (transportistas ?? []).map((t) => [t.id, t.nombre])
  );

  const hojasVisibles = filtrarSinAsignar
    ? hojas.filter((h) => !asignacionPorHoja.has(h.noHojaRuta))
    : hojas;

  return (
    <div className="flex-1 bg-zinc-50 px-4 py-8 dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
            Asignación de hojas de ruta
          </h1>
          <form className="flex items-center gap-3">
            <input
              type="date"
              name="fecha"
              defaultValue={fechaISO}
              className="rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm text-black outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-50"
            />
            <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                name="soloSinAsignar"
                value="1"
                defaultChecked={filtrarSinAsignar}
              />
              Solo sin asignar
            </label>
            <button
              type="submit"
              className="rounded-md border border-black/[.08] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
            >
              Ver
            </button>
          </form>
        </div>

        {hojasVisibles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {hojas.length === 0
              ? "No hay hojas de ruta planificadas para esta fecha."
              : "No hay hojas de ruta sin asignar para esta fecha."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[.03] text-zinc-600 dark:bg-white/[.06] dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Hoja de ruta</th>
                  <th className="px-4 py-2 font-medium">Fecha de registro</th>
                  <th className="px-4 py-2 font-medium">Comentario</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Transportista</th>
                </tr>
              </thead>
              <tbody>
                {hojasVisibles.map((hoja) => {
                  const transportistaAsignadoId = asignacionPorHoja.get(
                    hoja.noHojaRuta
                  );
                  const nombreAsignado = transportistaAsignadoId
                    ? nombrePorTransportista.get(transportistaAsignadoId)
                    : undefined;
                  return (
                    <tr
                      key={hoja.noHojaRuta}
                      className="border-t border-black/[.08] dark:border-white/[.145]"
                    >
                      <td className="px-4 py-2 font-medium text-black dark:text-zinc-50">
                        {hoja.noHojaRuta}
                      </td>
                      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                        {formatearFechaSql(hoja.fechaRegistro)}
                      </td>
                      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                        {hoja.comentario || "—"}
                      </td>
                      <td className="px-4 py-2">
                        {transportistaAsignadoId ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Asignada a {nombreAsignado ?? "—"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                            <span className="h-2 w-2 rounded-full bg-zinc-400" />
                            Sin asignar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <form
                            action={asignarHojaRuta}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="noHojaRuta"
                              value={hoja.noHojaRuta}
                            />
                            <select
                              name="transportistaUserId"
                              defaultValue={transportistaAsignadoId ?? ""}
                              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-sm text-black outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-50"
                            >
                              <option value="" disabled>
                                Elegir transportista
                              </option>
                              {(transportistas ?? []).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nombre}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                            >
                              {transportistaAsignadoId ? "Actualizar" : "Asignar"}
                            </button>
                          </form>
                          {transportistaAsignadoId && (
                            <form action={desasignarHojaRuta}>
                              <input
                                type="hidden"
                                name="noHojaRuta"
                                value={hoja.noHojaRuta}
                              />
                              <button
                                type="submit"
                                className="rounded-md border border-black/[.08] px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-[#1a1a1a]"
                              >
                                Quitar
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
