/** Clerk throws structured errors; surface the human-readable one when present. */
export function clerkMessage(err: unknown): string | null {
  const errors = (err as { errors?: { longMessage?: string; message?: string }[] })?.errors;
  return errors?.[0]?.longMessage ?? errors?.[0]?.message ?? null;
}
