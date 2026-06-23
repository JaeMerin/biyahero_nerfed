export default async (request, context) => {
  const response = await context.next();
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  );

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://unpkg.com https://www.tuqlas.com https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com",
    "font-src 'self' https://unpkg.com https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https://unpkg.com https://www.tuqlas.com https://*.tile.openstreetmap.org",
    "connect-src 'self' https://gfppsqhbvzluefvzvnev.supabase.co https://www.tuqlas.com https://unpkg.com https://cdn.jsdelivr.net",
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