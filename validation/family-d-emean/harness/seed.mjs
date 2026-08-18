// harness/seed.mjs — per-stream splitmix64, replacing the first run's avalanche-hashed offsets
// into one shared 32-bit LCG cycle (review finding, 2026-08-18: with ~232k streams consuming
// ~5.1e8 of the 2^32 cycle, thousands of substreams overlapped, violating Amendment A1.3's
// registered disjointness). Streams here are splitmix64 counters started at structurally
// distinct 64-bit keys: two streams collide only if their keys differ by a multiple of the
// gamma inside the consumed range, expected ~1e-4 overlapping pairs run-wide.

const MASK64 = 0xFFFFFFFFFFFFFFFFn;
const GAMMA = 0x9E3779B97F4A7C15n;

/** Bit-disjoint packing: cell in [0,255] at bits 40+, draw in [0,4095] at 20+, traj in
 *  [0,1048575] at 0+. Distinct triples give distinct keys by construction. */
export function streamKey(cellIdx, draw, traj) {
  if (!(Number.isInteger(cellIdx) && cellIdx >= 0 && cellIdx < 256)) throw new Error(`cellIdx out of range: ${cellIdx}`);
  if (!(Number.isInteger(draw) && draw >= 0 && draw < 4096)) throw new Error(`draw out of range: ${draw}`);
  if (!(Number.isInteger(traj) && traj >= 0 && traj < 1048576)) throw new Error(`traj out of range: ${traj}`);
  return (BigInt(cellIdx) << 40n) | (BigInt(draw) << 20n) | BigInt(traj);
}

/** splitmix64 uniform stream on [0, 1), 53-bit resolution. */
export function streamRng(cellIdx, draw, traj) {
  let s = (streamKey(cellIdx, draw, traj) * 0x2545F4914F6CDD1Dn) & MASK64;
  return () => {
    s = (s + GAMMA) & MASK64;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    z = z ^ (z >> 31n);
    return Number(z >> 11n) / 9007199254740992;
  };
}
