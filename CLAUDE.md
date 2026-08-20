@AGENTS.md

# Contexto del proyecto

App interna de Santillana para gestión de fechas de entrega. Dos bases de datos con roles distintos:
- **SQL Server** (`src/lib/sql-server.ts`): base legacy existente, **solo lectura**. Nunca escribir ahí.
- **Supabase**: base de escritura + autenticación de la app.

# Autenticación

- Login con **email + contraseña** vía Supabase Auth (no hay concepto de "username" separado).
- **No hay registro público.** Los usuarios se crean manualmente desde el Supabase Dashboard (Authentication → Users → "Add user", marcando "Auto Confirm User" en desarrollo).
- Toda la app está protegida por defecto excepto `/login`. La lógica de redirección vive en `src/lib/supabase/middleware.ts` (función `updateSession`), invocada desde `src/proxy.ts`.
- Clientes Supabase: `src/lib/supabase/client.ts` (Client Components), `src/lib/supabase/server.ts` (Server Components/Actions).
- Server Actions de auth: `src/app/login/actions.ts` (`login`, `logout`).

# Gotcha importante: ubicación de proxy.ts

Next.js 16 renombró `middleware.ts` a `proxy.ts` (deprecation notice en `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). Como este proyecto usa layout `src/` (el directorio `app/` vive en `src/app/`), **`proxy.ts` debe estar en `src/proxy.ts`, no en la raíz del repo** — Next.js exige que esté al mismo nivel que `app/`. Ponerlo en la raíz falla en silencio: compila sin error pero el archivo nunca se ejecuta (no aparece "proxy.ts" en los logs de tiempo de request). Si mueves o creas archivos de convención de Next.js (`proxy.ts`, `instrumentation.ts`, etc.), verifica primero dónde vive `app/`.

# Desarrollo local

- `npm run dev` levanta en el puerto 3000 por defecto, pero en esta máquina a veces ese puerto ya está ocupado por otro proceso ajeno al proyecto — revisa el log de arranque para confirmar el puerto real antes de asumir 3000.
