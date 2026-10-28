export function isD1QuotaError(error: unknown): boolean {
  let cause = error;
  for (let depth = 0; depth < 4 && cause instanceof Error; depth++) {
    if (
      /exceeded.*(?:D1|daily).*(?:row read|row write).*limit|D1.*free tier daily.*limit/i.test(
        cause.message,
      )
    )
      return true;
    cause = cause.cause;
  }
  return false;
}

export function quotaResponse(now = Date.now()) {
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return new Response(
    JSON.stringify({
      error:
        'Il servizio dati ha raggiunto il limite giornaliero. Sarà nuovamente disponibile dopo il ripristino delle 00:00 UTC.',
      code: 'D1_DAILY_LIMIT',
      retryAt: reset.toISOString(),
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': String(Math.max(1, Math.ceil((reset.getTime() - now) / 1000))),
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
