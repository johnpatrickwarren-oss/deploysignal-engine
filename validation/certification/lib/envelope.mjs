// validation/certification/lib/envelope.mjs
//
// I3(b) -- protocol S4.4 ("Wiring: a ValidityEnvelope entry exists"). That is a fact
// about `fleet/e-bh-guarded.ts`'s DETECTOR_ENVELOPES map, not something a card can
// assert about itself, so it is read out of the file mechanically.

// The map is a single `Object.freeze({ ... })` literal keyed by detector id.
const MAP_BLOCK = /DETECTOR_ENVELOPES[^=]*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\)/;
const KEY_LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/;

/** Detector ids keyed in DETECTOR_ENVELOPES. Returns [] when the map is absent or
 *  unparseable, which degrades to "nothing is wired" -- the conservative direction for
 *  a check whose finding is a recorded gap. */
export function envelopeKeys(src) {
  const block = MAP_BLOCK.exec(src);
  if (!block) return [];
  const keys = [];
  for (const line of block[1].split('\n')) {
    if (/^\s*\/\//.test(line)) continue;          // a commented-out entry is not wired
    const m = KEY_LINE.exec(line);
    if (m) keys.push(m[1]);
  }
  return keys;
}

/** Whether a card's identity reaches an envelope key. Exact match, or the candidate is
 *  a multi-token underscore-boundary SUFFIX of a key -- the real family_A_mixture case,
 *  where the card's alias is `mixture_supermartingale` and the key is
 *  `page_cusum_mixture_supermartingale`. A single bare token ('supermartingale') is too
 *  weak an identity to claim wiring on, so the suffix must itself contain an underscore. */
export function isWired(detectorId, aliases, keys) {
  const candidates = [detectorId, ...(aliases ?? [])];
  return candidates.some((c) => keys.some((k) => k === c || (c.includes('_') && k.endsWith(`_${c}`))));
}
