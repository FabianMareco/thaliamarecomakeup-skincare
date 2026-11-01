import { waLink } from "@/lib/domain/phone";
import { cx } from "./ui";

export function WhatsAppButton({
  number,
  text,
  label = "Escribinos por WhatsApp",
  className,
}: {
  number: string;
  text?: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={waLink(number, text)}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1f8f4e] px-5 py-3 text-[15px] font-medium text-white hover:bg-[#187a42]",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
      </svg>
      {label}
    </a>
  );
}

export function PrivacyNotice({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs leading-relaxed text-muted", className)}>
      Usamos tus datos (nombre, WhatsApp y email) solo para gestionar tu reserva y enviarte avisos sobre ella. No los compartimos con
      terceros. Podés pedir acceso, rectificación o supresión escribiéndonos por WhatsApp (Ley 25.326 de Protección de Datos Personales).
    </p>
  );
}
