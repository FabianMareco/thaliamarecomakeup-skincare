import { listServices } from "@/server/repo/services";
import { ServicesEditor } from "./ServicesEditor";

export const metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const services = await listServices();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Servicios</h1>
      <p className="text-sm text-muted">
        Los cambios de precio no afectan a las reservas ya hechas. La duración de skincare es el bloque total, incluyendo preparación y limpieza.
      </p>
      <ServicesEditor services={services} />
    </div>
  );
}
