export default async (request, context) => {
  const response = await context.next();
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  );

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src 'self' https://gfppsqhbvzluefvzvnev.supabase.co`,
    "frame-ancestors 'none'",
  ].join("; ");

  const html = await response.text();

  const patched = html.replace(
    /<script(?![^>]*\bnonce=)/gi,
    `<script nonce="${nonce}"`
  );

  return new Response(patched, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      "Content-Security-Policy": csp,
    },
  });
};