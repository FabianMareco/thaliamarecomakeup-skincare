import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatARS } from "@/lib/domain/money";
import { fmtDateStrLong, fmtDateTimeShort } from "@/lib/domain/time";
import { STATUS_LABEL } from "@/lib/domain/transitions";
import type { Booking, BookingStatus, Receipt } from "@/lib/domain/types";

export function statusTone(s: BookingStatus) {
  if (s === "confirmed" || s === "completed") return "ok" as const;
  if (s === "awaiting_verification" || s === "awaiting_approval" || s === "requested") return "warn" as const;
  if (s === "awaiting_payment") return "info" as const;
  return "danger" as const;
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={statusTone(status)}>{STATUS_LABEL[status]}</Badge>;
}

export function whenShort(b: Booking): string {
  if (b.startAt) return fmtDateTimeShort(b.startAt) + " hs";
  if (b.makeup) return `${fmtDateStrLong(b.makeup.eventDate)} (lista ${b.makeup.readyByTime})`;
  return "";
}

/** Fila compacta que lleva al detalle de la reserva. */
export function BookingRow({ b, extra }: { b: Booking; extra?: React.ReactNode }) {
  return (
    <Link href={`/panel/reservas/${b.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-accent">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{b.code}</span>
        <StatusBadge status={b.status} />
      </div>
      <p className="mt-1 font-medium">{b.client.name}</p>
      <p className="text-sm text-muted">{b.service.name}</p>
      <p className="text-sm">{whenShort(b)}</p>
      {extra}
    </Link>
  );
}

export function ReceiptPreview({ bookingId, index, receipt }: { bookingId: string; index: number; receipt: Receipt }) {
  if (!receipt.path) return <p className="text-sm text-muted">Sin archivo (cargado por Thalia).</p>;
  const src = `/api/panel/comprobante?b=${encodeURIComponent(bookingId)}&i=${index}`;
  const isPdf = receipt.contentType === "application/pdf";
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line bg-sand/40">
      {isPdf ? (
        <span className="flex h-24 items-center justify-center text-sm font-medium text-accent">Ver comprobante (PDF) ↗</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Comprobante de transferencia" className="max-h-96 w-full object-contain" loading="lazy" />
      )}
    </a>
  );
}

export const money = formatARS;
