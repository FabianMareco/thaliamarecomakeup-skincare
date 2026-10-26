import { NextResponse } from "next/server";
import { getAdmin } from "@/server/auth";
import { bucket } from "@/server/firebase";
import { receiptViewUrl } from "@/server/flows/receipts";
import { getBooking } from "@/server/repo/bookings";

// Ver un comprobante desde el panel. Solo con sesión de administradora:
// redirige a una URL firmada de 5 minutos o, si no se puede firmar (por
// ejemplo, con el emulador), sirve el archivo directamente.
export async function GET(req: Request) {
  if (!(await getAdmin())) return new NextResponse("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const bookingId = url.searchParams.get("b") ?? "";
  const index = Number(url.searchParams.get("i") ?? "-1");
  const booking = /^[A-Za-z0-9_-]{1,150}$/.test(bookingId) ? await getBooking(bookingId) : null;
  const receipt = booking?.deposit.receipts[index];
  if (!receipt?.path) return new NextResponse("No encontrado", { status: 404 });

  const signed = await receiptViewUrl(receipt.path);
  if (signed) return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });

  const [bytes] = await bucket().file(receipt.path).download();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": receipt.contentType ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
