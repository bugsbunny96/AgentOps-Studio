/** SEC-07 — SSRF protection for the website crawler */
import { describe, it, expect, vi } from 'vitest';
import { assertPublicHttpUrl, isPublicIp, safeFetch, UnsafeUrlError } from '@/utils/safeFetch';

const dns = (map: Record<string, string[]>) => async (host: string) =>
  (map[host] ?? []).map((address) => ({ address }));

describe('isPublicIp', () => {
  it.each(['8.8.8.8', '104.16.1.1', '2606:4700::1111'])('allows %s', (ip) => expect(isPublicIp(ip)).toBe(true));
  it.each([
    '127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.5', 'not-an-ip',
  ])('blocks %s', (ip) => expect(isPublicIp(ip)).toBe(false));
});

describe('assertPublicHttpUrl', () => {
  const resolve = dns({ 'shop.example.com': ['93.184.216.34'], 'evil.example.com': ['93.184.216.34', '10.0.0.7'], 'meta.example.com': ['169.254.169.254'] });

  it('accepts a public https site', async () => {
    await expect(assertPublicHttpUrl('https://shop.example.com/about', resolve)).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ['http://localhost/api', 'local'],
    ['http://localhost:3001/api', 'port'],
    ['http://127.0.0.1/', 'private'],
    ['http://169.254.169.254/latest/meta-data/', 'private'],
    ['http://[::1]/', 'private'],
    ['http://meta.example.com/', 'private'],           // name resolving to metadata IP
    ['http://evil.example.com/', 'private'],           // any private address in the set
    ['ftp://shop.example.com/', 'http'],
    ['file:///etc/passwd', 'http'],
    ['https://shop.example.com:6379/', 'port'],
    ['https://user:pw@shop.example.com/', 'credentials'],
    ['https://unknown.example.com/', 'resolve'],
    ['not a url', 'Invalid'],
  ])('rejects %s', async (url, why) => {
    await expect(assertPublicHttpUrl(url, resolve)).rejects.toThrow(new RegExp(why, 'i'));
  });
});

describe('safeFetch', () => {
  const resolve = dns({ 'shop.example.com': ['93.184.216.34'], 'cdn.example.com': ['93.184.216.35'] });

  it('follows a redirect to another public host', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://cdn.example.com/home' } }))
      .mockResolvedValueOnce(new Response('<html>ok</html>', { status: 200 }));
    const res = await safeFetch('https://shop.example.com/', {}, { resolve, fetchImpl });
    expect(await res.text()).toBe('<html>ok</html>');
    expect(fetchImpl).toHaveBeenLastCalledWith('https://cdn.example.com/home', expect.objectContaining({ redirect: 'manual' }));
  });

  it('refuses a redirect to an internal address', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }),
    );
    await expect(safeFetch('https://shop.example.com/', {}, { resolve, fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stops after too many redirects', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      new Response(null, { status: 302, headers: { location: 'https://shop.example.com/loop' } }));
    await expect(safeFetch('https://shop.example.com/', {}, { resolve, fetchImpl, maxRedirects: 3 })).rejects.toThrow(/redirects/);
  });
});
