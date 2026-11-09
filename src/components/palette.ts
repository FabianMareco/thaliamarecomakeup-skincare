// Colores de las cards de tratamientos, uno por categoría (se repiten en orden).
// Los tonos claros van de fondo; el ciruela (plum) para precios y etiquetas.

const TONES = [
  { card: "bg-peach/45 border-peach", dot: "bg-peach" },
  { card: "bg-salmon/40 border-salmon", dot: "bg-salmon" },
  { card: "bg-rose/30 border-rose", dot: "bg-rose" },
  { card: "bg-mauve/20 border-mauve/60", dot: "bg-mauve" },
] as const;

export function categoryTone(index: number) {
  return TONES[index % TONES.length];
}
