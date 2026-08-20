import { redirect } from "next/navigation";
import { esGestor, getCurrentProfile } from "@/lib/supabase/profile";

export default async function Home() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <p className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
          Tu cuenta no tiene un perfil configurado todavía. Contacta al
          administrador para que te asigne un rol.
        </p>
      </div>
    );
  }

  redirect(esGestor(profile.role) ? "/asignaciones" : "/mis-rutas");
}
