export default async (request, context) => {
  const response = await context.next();
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  );

  const csp = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' https://unpkg.com https://www.tuqlas.com`,
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https://unpkg.com https://www.tuqlas.com",
  "connect-src 'self' https://gfppsqhbvzluefvzvnev.supabase.co https://www.tuqlas.com https://unpkg.com",
  "frame-src 'none'",
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