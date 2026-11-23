import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// El layout del panel no protege a las páginas: Next.js las renderiza en paralelo
// (y en las navegaciones el layout ni se vuelve a ejecutar), así que sus datos
// podían viajar en la respuesta aunque el layout redirigiera al login.
// Cada página del panel tiene que verificar la sesión ella misma, antes de leer datos.

const ROOT = join(__dirname, "(app)");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return pages(p);
    return f === "page.tsx" ? [p] : [];
  });
}

describe("páginas del panel", () => {
  const files = pages(ROOT);

  it("hay páginas para revisar", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => [f.slice(ROOT.length + 1)]))("%s verifica la sesión antes de leer datos", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    const body = src.split(/export default async function \w+\([^)]*\)[^{]*\{/)[1] ?? "";
    const firstStatement = body.trim().split("\n")[0];
    expect(firstStatement).toMatch(/^(await requireAdmin\(\);|const admin = await requireAdmin\(\);)$/);
  });
});
