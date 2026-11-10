import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { WhatsAppButton } from "@/components/site";
import { formatARS } from "@/lib/domain/money";
import { getTenant } from "@/server/repo/tenant";

export const metadata: Metadata = { title: "Turnos" };

const ENTRIES = [
  {
    href: "/turnos/estetica",
    eyebrow: "Skincare",
    title: "Tratamientos faciales",
    text: "Reservá online: elegí el tratamiento, el día y el horario.",
    cta: "Reservar turno",
    image: "/images/turnos/tratamientos-faciales.jpg",
  },
  {
    href: "/turnos/maquillaje",
    eyebrow: "Makeup",
    title: "Maquillaje y peinado",
    text: "Solicitá tu fecha para eventos, quinceañeras, novias y producciones.",
    cta: "Solicitar fecha",
    image: "/images/turnos/maquillaje-y-peinado.jpg",
  },
];

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
        {ENTRIES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="group relative isolate overflow-hidden rounded-3xl border border-line bg-white p-6 transition-colors hover:border-accent"
          >
            {/* Imagen de fondo al 30 % de opacidad (70 % de transparencia) para que el texto se lea bien. */}
            <Image src={e.image} alt="" fill sizes="(max-width: 672px) 100vw, 672px" className="-z-10 object-cover opacity-30 transition-opacity group-hover:opacity-40" priority />
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">{e.eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl">{e.title}</h2>
            <p className="mt-1 text-[15px] text-ink/80">{e.text}</p>
            <p className="mt-4 text-sm font-medium text-accent group-hover:underline">{e.cta} →</p>
          </Link>
        ))}
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
            <strong>Maquillaje:</strong> seña del {tenant.makeup.depositPercent} % del servicio, una vez coordinada la fecha. La seña no
            se reintegra.
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
