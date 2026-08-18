// American Soundex — reduces a word to a "sounds like" code (1 letter + 3
// digits) so names spelled differently but pronounced alike still match
// (e.g. "Celeste" and "Selest" both code to C423).
export function soundex(word: string): string {
  const w = word.toUpperCase().replace(/[^A-Z]/g, '')
  if (!w) return ''
  const codes: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  }
  let result = w[0]
  let prevCode = codes[w[0]] ?? ''
  for (let i = 1; i < w.length && result.length < 4; i++) {
    const code = codes[w[i]] ?? ''
    if (code && code !== prevCode) result += code
    // H/W don't break a run of the same code from repeating; vowels do.
    if (w[i] !== 'H' && w[i] !== 'W') prevCode = code
  }
  return (result + '000').slice(0, 4)
}

// True if `query` plausibly refers to `name` — used for the OTP-login
// "Find my account" search, which intentionally accepts partial and
// misspelled input rather than requiring an exact full name. Matches when
// any word in the name starts with the query, contains it, or sounds like
// it (Soundex) — not just on an exact whole-string match.
export function matchesNameQuery(name: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return false
  const haystack = name.trim().toLowerCase()
  if (haystack === needle) return true

  const words = haystack.split(/\s+/).filter(Boolean)
  if (words.some((w) => w.startsWith(needle) || needle.startsWith(w))) return true
  if (haystack.includes(needle)) return true

  // Soundex is noisy for very short input (e.g. a single letter) — only
  // apply it once there's enough signal to mean something.
  if (needle.length < 3) return false
  const needleCode = soundex(needle)
  return words.some((w) => soundex(w) === needleCode)
}
