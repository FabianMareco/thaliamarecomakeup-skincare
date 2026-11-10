// Colores de las cards de tratamientos (paleta Muted Earthy Tones: peach,
// salmon, rose, mauve y plum). Cada card mezcla dos tonos vecinos en un
// degradé suave y la siguiente cambia de mezcla, así la lista queda variada.
// El ciruela (plum) se usa además para precios y etiquetas.

const MIXES = [
  { card: "bg-linear-to-br from-peach/70 to-salmon/45 border-peach", dot: "bg-peach" },
  { card: "bg-linear-to-br from-salmon/55 to-rose/35 border-salmon", dot: "bg-salmon" },
  { card: "bg-linear-to-br from-rose/40 to-mauve/30 border-rose", dot: "bg-rose" },
  { card: "bg-linear-to-br from-mauve/30 to-plum/15 border-mauve/60", dot: "bg-mauve" },
  { card: "bg-linear-to-br from-peach/60 to-rose/35 border-salmon", dot: "bg-plum" },
] as const;

/** Mezcla de colores para la card número `index` (se repiten en orden). */
export function cardTone(index: number) {
  return MIXES[index % MIXES.length];
}
