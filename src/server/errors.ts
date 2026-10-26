/** Error con un mensaje apto para mostrarle a la clienta o a Thalia. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Ejecuta una acción y traduce los errores esperables a un mensaje. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof UserError || (e as Error)?.name === "RateLimitError") {
      return { ok: false, error: (e as Error).message };
    }
    if ((e as Error)?.name === "InvalidTransitionError") {
      return { ok: false, error: "La reserva cambió de estado. Recargá la página e intentá de nuevo." };
    }
    console.error(e);
    return { ok: false, error: "Ocurrió un error inesperado. Intentá de nuevo en unos minutos." };
  }
}
