/**
 * SSRF-safe fetch for user-supplied URLs (SEC-07)
 *
 * The crawler fetches whatever website an org enters. Without checks a URL
 * (or a redirect, or a sitemap entry) could point at localhost, the cloud
 * metadata service (169.254.169.254) or private network ranges.
 *
 *  - only http/https on the default ports
 *  - the hostname must resolve, and EVERY resolved address must be public
 *  - redirects are followed manually (max 5) and each hop is re-checked
 *
 * Residual risk: DNS rebinding between our lookup and fetch's own lookup.
 * Acceptable for a crawler that only reads public pages; revisit if this is
 * ever used for authenticated or write requests (e.g. INT-01 webhooks).
 */
import { BlockList, isIP } from 'net';
import { lookup } from 'dns/promises';

const blocked = new BlockList();
// IPv4
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
// IPv6
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32],
] as const) blocked.addSubnet(net, prefix, 'ipv6');

export class UnsafeUrlError extends Error {
  constructor(message: string) { super(message); this.name = 'UnsafeUrlError'; }
}

export function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, 'ipv4');
  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d) → judge the IPv4 address
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return isPublicIp(mapped[1]);
    return !blocked.check(ip, 'ipv6');
  }
  return false;
}

type Resolver = (host: string) => Promise<Array<{ address: string }>>;
const defaultResolver: Resolver = (host) => lookup(host, { all: true, verbatim: true });

/** Throws UnsafeUrlError unless `raw` is an http(s) URL whose host resolves only to public IPs. */
export async function assertPublicHttpUrl(raw: string, resolve: Resolver = defaultResolver): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new UnsafeUrlError('Invalid URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http and https URLs are allowed');
  if (url.port && url.port !== '80' && url.port !== '443') throw new UnsafeUrlError('Only the standard web ports are allowed');
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are not allowed');

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new UnsafeUrlError('Local addresses are not allowed');
  }

  const addresses = isIP(host) ? [{ address: host }] : await resolve(host).catch(() => []);
  if (addresses.length === 0) throw new UnsafeUrlError('Could not resolve the website address');
  if (!addresses.every((a) => isPublicIp(a.address))) throw new UnsafeUrlError('Private or reserved addresses are not allowed');
  return url;
}

/** fetch() that validates the URL and every redirect hop. */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  opts: { maxRedirects?: number; resolve?: Resolver; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 5;
  const doFetch = opts.fetchImpl ?? fetch;
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicHttpUrl(current, opts.resolve);
    const resp = await doFetch(url.toString(), { ...init, redirect: 'manual' });
    if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
      current = new URL(resp.headers.get('location')!, url).toString();
      continue;
    }
    return resp;
  }
  throw new UnsafeUrlError('Too many redirects');
}
