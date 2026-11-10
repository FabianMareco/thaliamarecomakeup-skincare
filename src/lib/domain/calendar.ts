// Evento de calendario de un turno: link de "Agregar a Google Calendar" y
// archivo .ics (iPhone, Outlook, Gmail). Sin APIs ni permisos: la paciente lo
// agrega con un toque.

export type CalendarEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  details: string;
  location?: string;
};

/** "20261116T120000Z" */
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utcStamp(e.start)}/${utcStamp(e.end)}`,
    details: e.details,
    ctz: "America/Argentina/Buenos_Aires",
  });
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Corta las líneas a 75 bytes como pide el estándar iCalendar. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (Buffer.byteLength(current + ch, "utf8") > limit) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function icsContent(e: CalendarEvent, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Thalia Mareco//Turnos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(e.start)}`,
    `DTEND:${utcStamp(e.end)}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(e.details)}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(e.title)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
