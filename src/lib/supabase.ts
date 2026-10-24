import { createClient } from "@supabase/supabase-js";

/*
 * Vite inlines `import.meta.env.VITE_*` as literals at build time. That makes
 * any guard derived from them a build-time constant, and the minifier will
 * dead-code-eliminate every branch behind it -- which silently strips the
 * entire application from the bundle while still reporting a clean build.
 * (Observed: a 260 kB "successful" bundle containing React and nothing else.)
 *
 * Spreading into a plain object defeats that folding: the values are read from
 * a mutable runtime object, so the bundler cannot prove the guard's outcome and
 * must keep both branches. Keep the spread.
 */
const env: Record<string, string | undefined> = { ...import.meta.env };

const url = env.VITE_SUPABASE_URL ?? "";
const anonKey = env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(url && anonKey);

export const missingEnvVars = [
  !url && "VITE_SUPABASE_URL",
  !anonKey && "VITE_SUPABASE_ANON_KEY",
].filter(Boolean) as string[];

// Placeholder credentials keep createClient from throwing on an empty URL, so
// an unconfigured app reaches the ConfigError screen instead of a white page.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      // Persisted so a nurse who locks their phone mid-shift stays signed in.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
