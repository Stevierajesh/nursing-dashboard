import { missingEnvVars } from "../lib/supabase";

/**
 * Shown when the Supabase env vars are absent.
 *
 * This exists because the alternative -- throwing at module scope -- lets the
 * bundler strip the whole app behind the throw while still reporting a clean
 * build. A visible screen is both safer and more useful.
 */
export default function ConfigError() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-critical/30 bg-critical/5 p-6">
        <h1 className="text-lg font-semibold text-critical">Configuration needed</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-200">
          This app cannot reach Supabase because the following environment
          variables are not set:
        </p>
        <ul className="mt-3 space-y-1">
          {missingEnvVars.map((v) => (
            <li
              key={v}
              className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 font-mono text-xs"
            >
              {v}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-ink-400">
          Copy <code className="text-ink-200">.env.example</code> to{" "}
          <code className="text-ink-200">.env.local</code>, fill in the project
          URL and <strong>anon</strong> key from the Supabase dashboard, then
          restart the dev server.
        </p>
      </div>
    </div>
  );
}
