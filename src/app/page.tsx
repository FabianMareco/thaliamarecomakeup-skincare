import { redirect } from "next/navigation";

// La web institucional todavía no está terminada: por ahora la portada
// lleva directo a la sección de turnos.
export default function Home() {
  redirect("/turnos");
}
