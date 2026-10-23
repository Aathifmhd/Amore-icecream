/**
 * Demo card payments at checkout (DEMO_CARD_PAYMENTS in config.ts). There is no payment gateway
 * and no money is taken, so only these test cards work — nobody can think they paid with a real
 * card. Only the card's brand and last 4 digits are kept with the order.
 */
export const TEST_CARDS = [
  { number: '4242 4242 4242 4242', brand: 'Visa', approved: true },
  { number: '5555 5555 5555 4444', brand: 'Mastercard', approved: true },
  // Shows what a declined card looks like
  { number: '4000 0000 0000 0002', brand: 'Visa', approved: false },
] as const;

export const cardDigits = (v: string) => v.replace(/\D/g, '');

const testCard = (number: string) => TEST_CARDS.find((t) => cardDigits(t.number) === cardDigits(number));

/** The usual check-digit test every card number passes */
function luhnOk(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

export function cardBrandOf(number: string): 'Visa' | 'Mastercard' | null {
  const d = cardDigits(number);
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  return null;
}

export type CardField = 'number' | 'name' | 'expiry' | 'cvc';

/** What is wrong with the card details, or null when they are ready to "charge" */
export function checkDemoCard(
  card: { number: string; name: string; expiry: string; cvc: string },
  now = new Date()
): { field: CardField; message: string } | null {
  const d = cardDigits(card.number);
  if (d.length !== 16 || !luhnOk(d)) return { field: 'number', message: 'Check the card number — it should be 16 digits.' };
  if (!testCard(d)) return { field: 'number', message: 'This is a demo checkout, so real cards don’t work here. Tap “Use test card”.' };
  if (card.name.trim().length < 2) return { field: 'name', message: 'Add the name on the card.' };
  const m = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
  const month = m ? Number(m[1]) : 0;
  if (!m || month < 1 || month > 12) return { field: 'expiry', message: 'Add the expiry date as MM/YY.' };
  // A card works until the end of its expiry month
  if (new Date(2000 + Number(m[2]), month, 1) <= now) return { field: 'expiry', message: 'This card has expired.' };
  if (!/^\d{3}$/.test(card.cvc)) return { field: 'cvc', message: 'Add the 3-digit security code from the back of the card.' };
  return null;
}

/** The demo bank's answer */
export const demoCardApproved = (number: string) => testCard(number)?.approved ?? false;

/** A test card that is approved, valid for a few more years */
export function sampleTestCard(now = new Date()) {
  return { number: TEST_CARDS[0].number, expiry: `12/${String((now.getFullYear() + 3) % 100).padStart(2, '0')}`, cvc: '123' };
}
