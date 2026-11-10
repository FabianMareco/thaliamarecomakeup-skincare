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

/** Mezcla de colores siempre igual para un mismo id (cada reserva o paciente conserva su tono). */
export function toneFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return cardTone(h);
}

/** Colores de la agenda según el estado del horario o evento. */
export const AGENDA_TONES = {
  open: { item: "border-l-peach bg-peach/25", dot: "bg-peach", label: "Libre" },
  held: { item: "border-l-salmon bg-salmon/30", dot: "bg-salmon", label: "Retenido" },
  booked: { item: "border-l-rose bg-rose/30", dot: "bg-rose", label: "Reservado" },
  makeup_event: { item: "border-l-mauve bg-mauve/25", dot: "bg-mauve", label: "Evento maquillaje" },
  makeup_trial: { item: "border-l-plum bg-plum/15", dot: "bg-plum", label: "Prueba" },
} as const;

/** Mezcla de colores para la card número `index` (se repiten en orden). */
export function cardTone(index: number) {
  return MIXES[index % MIXES.length];
}
