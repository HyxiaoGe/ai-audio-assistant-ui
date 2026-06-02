/**
 * Same-origin avatar proxy URL rewriting.
 *
 * OAuth providers hand back avatar URLs on third-party image CDNs
 * (`https://lh3.googleusercontent.com/...`, GitHub, …). Browsers loading those
 * `<img>` elements directly are slow or blocked in CN — the login data already
 * returned; the only thing hanging is the picture. The backend exposes a
 * whitelist-fetch + cache proxy at `/api/v1/users/avatar`; this rewrites known
 * CDN URLs to that same-origin path so the browser loads them with a strong
 * cache (CORS handled by the `/api/v1` rewrite).
 *
 * Only whitelisted hosts are proxied; relative paths, `data:` URLs, unknown
 * hosts and non-https URLs pass through untouched (no point proxying those).
 */
const PROXIED_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "avatars.githubusercontent.com",
])

export function proxiedAvatar(rawUrl?: string | null): string | undefined {
  const url = rawUrl?.trim()
  if (!url) return undefined

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // Relative path or malformed absolute URL: hand to <img> as-is.
    return url
  }

  if (parsed.protocol === "https:" && PROXIED_HOSTS.has(parsed.hostname)) {
    return `/api/v1/users/avatar?url=${encodeURIComponent(url)}`
  }
  return url
}
