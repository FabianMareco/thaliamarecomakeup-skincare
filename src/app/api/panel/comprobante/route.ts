import { NextResponse } from "next/server";
import { getAdmin } from "@/server/auth";
import { readReceipt, receiptSignedUrl } from "@/server/receiptStore";
import { getBooking } from "@/server/repo/bookings";

// Ver un comprobante desde el panel. Solo con sesión de administradora:
// si el archivo está en Storage redirige a una URL firmada de 5 minutos; si
// está en Firestore (o no se puede firmar), sirve el archivo directamente.
export async function GET(req: Request) {
  if (!(await getAdmin())) return new NextResponse("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const bookingId = url.searchParams.get("b") ?? "";
  const index = Number(url.searchParams.get("i") ?? "-1");
  const booking = /^[A-Za-z0-9_-]{1,150}$/.test(bookingId) ? await getBooking(bookingId) : null;
  const receipt = booking?.deposit.receipts[index];
  if (!receipt?.path) return new NextResponse("No encontrado", { status: 404 });

  const signed = await receiptSignedUrl(receipt.path);
  if (signed) return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });

  const bytes = await readReceipt(receipt.path);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": receipt.contentType ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
