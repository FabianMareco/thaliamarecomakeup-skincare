import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/site";
import { formatARS } from "@/lib/domain/money";
import { getTenant } from "@/server/repo/tenant";

export const metadata: Metadata = { title: "Turnos" };

export default async function TurnosPage() {
  const tenant = await getTenant();
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Turnos online</p>
        <h1 className="font-display text-4xl leading-tight">¿Qué querés reservar?</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Cosmetología y maquillaje profesional en {tenant.publicZone}. Elegí la opción que buscás.
        </p>
      </div>

      <div className="grid gap-4">
        <Link href="/turnos/estetica" className="group rounded-3xl border border-line bg-white p-6 transition-colors hover:border-accent">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Skincare</p>
          <h2 className="mt-2 font-display text-2xl">Tratamientos faciales</h2>
          <p className="mt-1 text-[15px] text-muted">Reservá online: elegí el tratamiento, el día y el horario.</p>
          <p className="mt-4 text-sm font-medium text-accent group-hover:underline">Reservar turno →</p>
        </Link>
        <Link href="/turnos/maquillaje" className="group rounded-3xl border border-line bg-white p-6 transition-colors hover:border-accent">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Makeup</p>
          <h2 className="mt-2 font-display text-2xl">Maquillaje y peinado</h2>
          <p className="mt-1 text-[15px] text-muted">Solicitá tu fecha para eventos, quinceañeras, novias y producciones.</p>
          <p className="mt-4 text-sm font-medium text-accent group-hover:underline">Solicitar fecha →</p>
        </Link>
      </div>

      <section className="space-y-3 rounded-3xl bg-sand/60 p-6">
        <h2 className="font-display text-xl">Políticas de reserva</h2>
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/90">
          <li>
            <strong>Tratamientos faciales:</strong> seña de {formatARS(tenant.skincare.depositAmount)} por transferencia. Cancelando o
            reprogramando con {tenant.skincare.cancellationWindowHours} hs o más de anticipación, elegís reintegro o nuevo turno; con
            menos, la seña no se reintegra.
          </li>
          <li>
            <strong>Maquillaje:</strong> seña del {tenant.makeup.depositPercent} % del servicio, una vez que Thalia confirma la fecha.
            La seña no se reintegra.
          </li>
          <li>El estudio no tiene sala de espera y los turnos empiezan puntuales.</li>
        </ul>
      </section>

      <div className="space-y-2">
        <p className="text-[15px] text-muted">¿Tenés dudas antes de reservar?</p>
        <WhatsAppButton number={tenant.whatsappNumber} />
      </div>
    </div>
  );
}
