// A small seeded random number generator (xorshift32): the same seed gives the
// same game, which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = (seed | 0) || 0x9e3779b9;
  return function random() {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    a >>>= 0;
    return a / 4294967296;
  };
}
