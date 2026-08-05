import { randomInt } from 'crypto';

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPERCASE + LOWERCASE + DIGITS;

function pickRandom(charset: string): string {
  return charset[randomInt(charset.length)];
}

/**
 * Generates a random password for accounts created by an admin (school admin
 * creation, join request approval) — never entered by the user, shown once
 * at confirmation. Avoids visually ambiguous characters (0/O, 1/l/I).
 */
export function generateRandomPassword(length = 12): string {
  const required = [
    pickRandom(UPPERCASE),
    pickRandom(LOWERCASE),
    pickRandom(DIGITS),
  ];
  const rest = Array.from({ length: length - required.length }, () =>
    pickRandom(ALL),
  );

  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
