import Link from "next/link";
import { redirect } from "next/navigation";
import { getHojasRutaPorNumeros } from "@/lib/hoja-ruta";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

export default async function MisRutasPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "transportista") {
    redirect("/asignaciones");
  }

  const supabase = await createClient();
  const { data: asignaciones } = await supabase
    .from("hoja_ruta_asignaciones")
    .select("no_hoja_ruta")
    .eq("transportista_user_id", profile.id)
    .eq("activo", true);

  const noHojasRuta = (asignaciones ?? []).map((a) => a.no_hoja_ruta as string);
  const hojas = await getHojasRutaPorNumeros(noHojasRuta);

  return (
    <div className="flex-1 bg-zinc-50 px-4 py-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Mis rutas
        </h1>

        {hojas.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Todavía no tienes hojas de ruta asignadas.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {hojas.map((hoja) => (
              <li key={hoja.noHojaRuta}>
                <Link
                  href={`/mis-rutas/${encodeURIComponent(hoja.noHojaRuta)}`}
                  className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-4 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-[#1a1a1a]"
                >
                  <div>
                    <p className="font-medium text-black dark:text-zinc-50">
                      {hoja.noHojaRuta}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {hoja.zona || "Sin zona"} · {hoja.placa || "Sin placa"}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-500">Ver pedidos →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
