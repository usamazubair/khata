/* Turns a bank SMS into a spending transaction, or returns null if the
 * message isn't one we recognise (or is one we deliberately ignore).
 *
 * Only debits (money going out) are parsed. Khata's categories are
 * expense/fixed/saved/budget — there's no "income" type — so a credit SMS
 * has nowhere to file to. Extending this to credits later means adding an
 * income category type on the server first; until then, parsing them here
 * would just build a feature with no destination.
 *
 * Each bank's SMS come in several distinct templates (a POS payment reads
 * nothing like an ATM withdrawal), so this is a small ordered rule list —
 * first template that matches wins — rather than one do-everything regex.
 * Two message types are deliberately unmatched, not overlooked:
 *   - Standard Chartered sends a *second* SMS with a Raast transaction ID
 *     for the same transfer a "sent to" message already covers; parsing
 *     it too would double-log one real transaction.
 *   - Bank Al Habib's SMS-alert-service-charge notice is a bank fee, not
 *     a purchase — not something you'd want cluttering your expenses.
 */

export type ParsedSmsTransaction = {
  amount: number;
  /** Which rule matched — shown in the review screen so a mis-parse is
   *  easy to trace back to the message that caused it. */
  bank: string;
  /** Best-effort description — merchant, payee, or "ATM Withdrawal". */
  merchant: string;
  /** YYYY-MM-DD. Khata only stores a date, not a time, for transactions. */
  occurredOn: string;
  /** The original message, kept for the review screen and for dedupe. */
  raw: string;
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const toAmount = (s: string) => Number(s.replace(/,/g, ""));

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "24-Aug-2026" -> "2026-08-24". */
function fromNamedMonth(d: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(d);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

/** "24-08-26" or "24-08-2026" -> "2026-08-24". A 2-digit year is always
 *  read as 20XX — every bank in this app's userbase sends current-era
 *  dates, and a 1900s reading would never make sense here. */
function fromNumericDate(d: string): string | null {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/.exec(d);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

type Rule = {
  bank: string;
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => Omit<ParsedSmsTransaction, "raw"> | null;
};

const RULES: Rule[] = [
  {
    // "PKR 3,000.00 sent to M DAUD ARIF EASYPAISA-TELENOR-xxxBANK from your
    //  A/C xxx6481 of SABZAZAR BR LHR on 24-Aug-2026 at 14:01 Fee: Rs.3.00 ..."
    bank: "Standard Chartered",
    pattern: /PKR ([\d,]+\.\d{2}) sent to (.+?) from your A\/C .*? on (\d{1,2}-[A-Za-z]{3}-\d{4})/i,
    extract: (m) => {
      const occurredOn = fromNamedMonth(m[3]);
      return occurredOn ? { amount: toAmount(m[1]), bank: "Standard Chartered", merchant: clean(m[2]), occurredOn } : null;
    },
  },
  {
    // "Dear Client, PKR 1,370.00 have been paid at MCDONALDS on 24-08-26
    //  using Debit Card no. 53119xxxxxxxx0527."
    bank: "Standard Chartered",
    pattern: /PKR ([\d,]+\.\d{2}) have been paid at (.+?) on (\d{1,2}-\d{1,2}-\d{2,4}) using Debit Card/i,
    extract: (m) => {
      const occurredOn = fromNumericDate(m[3]);
      return occurredOn ? { amount: toAmount(m[1]), bank: "Standard Chartered", merchant: clean(m[2]), occurredOn } : null;
    },
  },
  {
    // "Dear Client, PKR 25,000.00 were withdrawn from Account No.
    //  0173xxx2801 on 18-08-26 using an ATM."
    bank: "Standard Chartered",
    pattern: /PKR ([\d,]+\.\d{2}) were withdrawn from Account No\. \S+ on (\d{1,2}-\d{1,2}-\d{2,4}) using an ATM/i,
    extract: (m) => {
      const occurredOn = fromNumericDate(m[2]);
      return occurredOn ? { amount: toAmount(m[1]), bank: "Standard Chartered", merchant: "ATM Withdrawal", occurredOn } : null;
    },
  },
  {
    // "Dear MUHAMMAD, your  FBL Card has been charged for PKR 981 on
    //  24-08-2026 14:45:17 at Foodpanda Karachi Paki Karachi        PK.
    //  Available Limit: 587,749.85"
    bank: "Faysal Bank",
    pattern: /FBL Card has been charged for PKR ([\d,]+(?:\.\d{1,2})?) on (\d{1,2}-\d{1,2}-\d{2,4}) \d{2}:\d{2}:\d{2} at (.+?)\.\s*Available Limit/i,
    extract: (m) => {
      const occurredOn = fromNumericDate(m[2]);
      return occurredOn ? { amount: toAmount(m[1]), bank: "Faysal Bank", merchant: clean(m[3]), occurredOn } : null;
    },
  },
  {
    // "You made a POS transaction of PKR 23,000.00 at SAIF TRADERS from
    //  BAHL A/C **5011 through your Visa Silver Debit Card on 10-08-2026 ..."
    bank: "Bank Al Habib",
    pattern: /POS transaction of PKR ([\d,]+(?:\.\d{1,2})?) at (.+?) from BAHL A\/C .*? on (\d{1,2}-\d{1,2}-\d{2,4})/i,
    extract: (m) => {
      const occurredOn = fromNumericDate(m[3]);
      return occurredOn ? { amount: toAmount(m[1]), bank: "Bank Al Habib", merchant: clean(m[2]), occurredOn } : null;
    },
  },
];

export function parseSms(body: string): ParsedSmsTransaction | null {
  for (const rule of RULES) {
    const match = body.match(rule.pattern);
    if (!match) continue;
    const extracted = rule.extract(match);
    if (extracted && extracted.amount > 0) return { ...extracted, raw: body };
  }
  return null;
}
