/**
 * Permission ids name one kind of action a person can "always allow": `<domain>.<scope>.<action>`,
 * lower-case, dot-separated, every segment `[a-z0-9_-]`, e.g. `blog.mysite.publish`.
 * Ids are stable API: they are stored in people's config.
 *
 * A grant written by hand may use wildcards: `*` stands for exactly one segment and `**` for the
 * rest of the id (it must be the last segment), e.g. `blog.*.publish`, `x.**`. Requests always
 * carry exact ids.
 */

export const MAX_PERMISSION_ID_LENGTH = 120;
export const MAX_PERMISSION_ID_SEGMENTS = 8;

const SEGMENT = /^[a-z0-9_-]+$/;

/** What is wrong with `id` as a permission id or hand-written pattern, or null when it is fine. */
export function permissionIdProblem(id: unknown, { allowWildcards = false }: { allowWildcards?: boolean } = {}): string | null {
  if (typeof id !== "string" || id.length === 0) return "A permission id is required.";
  if (id.length > MAX_PERMISSION_ID_LENGTH) return `A permission id is at most ${MAX_PERMISSION_ID_LENGTH} characters.`;
  const segments = id.split(".");
  if (segments.length < 2) return "A permission id has at least two dot-separated segments, like blog.mysite.publish.";
  if (segments.length > MAX_PERMISSION_ID_SEGMENTS) return `A permission id has at most ${MAX_PERMISSION_ID_SEGMENTS} segments.`;
  for (const [index, segment] of segments.entries()) {
    if (segment === "*" || segment === "**") {
      if (!allowWildcards) return "Wildcards are only allowed in grants written by hand.";
      if (segment === "**" && index !== segments.length - 1) return "** must be the last segment.";
      continue;
    }
    if (!SEGMENT.test(segment)) return `Segment "${segment}" must use only a-z, 0-9, "_" and "-".`;
  }
  return null;
}

export function isValidPermissionId(id: unknown): id is string {
  return permissionIdProblem(id) === null;
}

export function hasWildcard(id: string): boolean {
  return id.split(".").some(segment => segment === "*" || segment === "**");
}

/** Whether `pattern` (an exact id, or one with wildcards) covers the exact id `id`. */
export function permissionPatternMatches(pattern: string, id: string): boolean {
  if (pattern === id) return true;
  if (!hasWildcard(pattern)) return false;
  const patternSegments = pattern.split(".");
  const idSegments = id.split(".");
  for (const [index, segment] of patternSegments.entries()) {
    if (segment === "**") return index === patternSegments.length - 1 && idSegments.length > index;
    if (index >= idSegments.length) return false;
    if (segment !== "*" && segment !== idSegments[index]) return false;
  }
  return patternSegments.length === idSegments.length;
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74,
  0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
  0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e,
  0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** SHA-256 of the UTF-8 text, as hex. Pure TypeScript so browser code (the Compose app) can build the same ids as the backend. */
function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64).fill(0);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[i]! + w[i]!) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((value, i) => {
      h[i] = (h[i]! + value) >>> 0;
    });
  }
  return h.map(value => value.toString(16).padStart(8, "0")).join("");
}

const SLUG_MAX_LENGTH = 40;
const SLUG_PREFIX_LENGTH = 22;
const SLUG_HASH_LENGTH = 16;

/**
 * Turns a user-chosen name (a blog, an account, a newsletter) into an id segment, so that different
 * names never share a segment (a grant for one account must not cover another).
 *
 * A name that already is a valid segment (`[a-z0-9_-]`, at most 40 characters) is returned unchanged,
 * which keeps ids made for plain names stable. Any other name becomes a readable sanitized prefix, `-`,
 * and the first 16 hex characters of the SHA-256 of the exact name (so "My Acct" and "my-acct", or two
 * long names that share their first 40 characters, differ). `default` is only ever the slug of "default".
 */
export function permissionSlug(name: string): string {
  if (name.length > 0 && name.length <= SLUG_MAX_LENGTH && SEGMENT.test(name)) return name;
  const prefix = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_PREFIX_LENGTH)
    .replace(/-+$/g, "");
  return `${prefix || "x"}-${sha256Hex(name).slice(0, SLUG_HASH_LENGTH)}`;
}
