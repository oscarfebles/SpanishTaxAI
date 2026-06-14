/**
 * Escalation trigger detection.
 *
 * Maps user messages to the 11 escalation criteria defined in Doc #1 v1.1 §12.
 * When a trigger fires, the chatbot:
 *   1. Still answers the informational part of the question (if any)
 *   2. Appends a clear recommendation to upgrade to DNV Pro Review (€499)
 *      or Premium + Asesor (€99/mo) depending on the trigger nature.
 *   3. Logs the trigger reason to conversation_logs.
 *
 * Detection is intentionally conservative: better to over-escalate (recommend
 * Pro Review for a borderline case) than to under-escalate (give cheap advice
 * on a high-stakes case the AI shouldn't be handling alone).
 */

// Each rule has:
//   id          — short code logged to conversation_logs
//   patterns    — array of regex; if ANY matches, trigger fires
//   product     — which product to recommend ('pro_review' | 'premium')
//   reason      — human-readable reason shown in the bot's escalation message
const ESCALATION_RULES = [
  {
    id: 'crypto_income',
    patterns: [
      /\bcrypto(?:currency)?\b/i,
      /\bbitcoin\b/i,
      /\bethereum\b/i,
      /\bdao\b/i,
      /\bweb3\b/i,
      /\bnft\b/i,
      /\b(?:paid|earn|earnings?) in (?:btc|eth|crypto)\b/i,
    ],
    product: 'pro_review',
    reason: 'Crypto-related income requires specialist review (Doc #1 §6.6 + §12 criterion #1).',
  },
  {
    id: 'us_llc_sole_member',
    patterns: [
      /\b(?:my|own)\s+(?:us\s+)?llc\b/i,
      /\b(?:single|sole)[\s-]member\s+llc\b/i,
      /\bcontrolled foreign company\b/i,
      /\bcfc\b/i,
      /\btransparencia fiscal\b/i,
    ],
    product: 'pro_review',
    reason: 'US LLC ownership triggers transparencia fiscal internacional analysis (Doc #1 §6.7 + §12 criterion #6).',
  },
  {
    id: 'tax_residency_conflict',
    patterns: [
      /\btax resident in (?:two|both|multiple)\b/i,
      /\bdual tax resident\b/i,
      /\btie[\s-]?breaker\b/i,
      /\b183[\s-]?day\b.*\b(?:conflict|both|two)\b/i,
    ],
    product: 'premium',
    reason: 'Tax residency conflict between jurisdictions requires specialist review (Doc #1 §12 criterion #2).',
  },
  {
    id: 'high_income_beckham',
    patterns: [
      /\b(?:600[\s,.]?000|600k|six\s+hundred\s+thousand)\b/i,
      /\b(?:>|over|above|more than)\s*€?\s*600/i,
      /\bhigh[\s-]net[\s-]worth\b/i,
    ],
    product: 'pro_review',
    reason: 'Income above €600k triggers Beckham 47% bracket — election strategy is critical (Doc #1 §9 + §12 criterion #4).',
  },
  {
    id: 'prior_spanish_residency',
    patterns: [
      /\b(?:was|been|lived)\s+(?:a\s+)?(?:tax\s+)?resident\s+(?:in|of)\s+spain\b/i,
      /\bprevious(?:ly)?\s+spanish\s+(?:tax\s+)?resident\b/i,
      /\b(?:my|i\s+had)\s+(?:a\s+)?student\s+visa\b.*spain\b/i,
      /\blived in spain before\b/i,
    ],
    product: 'pro_review',
    reason: 'Prior Spanish tax residency affects Beckham eligibility and DNV rules (Doc #1 §3.2 + §12 criterion #5).',
  },
  {
    id: 'employer_no_ccc',
    patterns: [
      /\bemployer\s+(?:has\s+)?(?:no|doesn['']t\s+have|never\s+had)\b.*\b(?:spain|spanish|ccc)\b/i,
      /\bcompany\s+(?:has\s+)?never\s+(?:had|hired|employed)\s+(?:anyone|workers?)\s+in\s+spain\b/i,
      /\bemployer\s+(?:won['']t|refus(?:es?|ing))\s+(?:to\s+)?register\b/i,
      /\bccc\b/i,
      /\bcódigo de cuenta de cotización\b/i,
    ],
    product: 'pro_review',
    reason: 'Foreign employer without Spanish CCC is a major bottleneck (Doc #1 §12 criterion #11). Employer of Record may be needed.',
  },
  {
    id: 'rejection_or_subsanacion',
    patterns: [
      /\b(?:my|the)\s+(?:dnv|application|visa)\s+(?:was|got)\s+rejected\b/i,
      /\bsubsanación\b/i,
      /\b(?:day|día)\s+20\b/i,
      /\b(?:additional|extra|more)\s+documents?\s+(?:requested|required)\b/i,
      /\brequerimiento\b/i,
    ],
    product: 'pro_review',
    reason: 'Active rejection or subsanación case — Pro Review provides response support before the 10-day deadline runs out.',
  },
  {
    id: 'family_complex',
    patterns: [
      /\bfamily reunification\b/i,
      /\b(?:my|our)\s+(?:wife|husband|spouse|partner|kids?|children|dependents?)\b.*\b(?:stuck|denied|outside|abroad)\b/i,
      /\b(?:wife|husband|spouse).*\bdifferent\s+nationality\b/i,
    ],
    product: 'pro_review',
    reason: 'Family application complexity requires case-specific review (Doc #1 §4.3 + §12 criterion #3).',
  },
  {
    id: 'modelo_720_721',
    patterns: [
      /\bmodelo\s*7[2]0\b/i,
      /\bmodelo\s*7[2]1\b/i,
      /\bforeign\s+assets?\b.*\b(?:€|euro|50[\s,.]?000)/i,
      /\b(?:fbar|fatca)\b/i,
    ],
    product: 'premium',
    reason: 'Foreign asset reporting (Modelo 720/721) requires ongoing compliance review (Doc #1 §10 mistake #6).',
  },
  {
    id: 'mixed_income_us',
    patterns: [
      /\bmixed\s+(?:1099|w[\s-]?2|s[\s-]?corp)\b/i,
      /\b(?:1099|w[\s-]?2)\s+(?:and|\+|plus)\s+(?:w[\s-]?2|1099|s[\s-]?corp)\b/i,
    ],
    product: 'pro_review',
    reason: 'Mixed US income structures (1099 + W-2 + S-Corp) need tailored documentation strategy.',
  },
];

/**
 * Returns the FIRST escalation rule that matches the message, or null.
 * If multiple rules would match, the order in ESCALATION_RULES sets priority
 * (crypto > LLC > tax residency conflict > high income > etc.).
 */
export function detectEscalation(message) {
  if (!message || typeof message !== 'string') return null;

  for (const rule of ESCALATION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        return {
          id: rule.id,
          product: rule.product,
          reason: rule.reason,
        };
      }
    }
  }

  return null;
}

/**
 * Returns the recommended product details for the system prompt to use
 * when building the escalation message.
 *
 * v1.1 changes:
 *   - Removed `calendly` field (no phone/call escalation per business decision)
 *   - Added `support_email` field for async escalation
 *   - Renamed pro_review → pro_audit (DNV Pro Audit)
 *   - Renamed premium → premium_concierge (Premium Concierge)
 *   - Updated descriptions to reflect Oscar-only async review (no external asesor)
 */
export function getProductDetails(productKey) {
  const products = {
    pro_review: {
      name: 'DNV Pro Audit',
      price: '€499 one-time',
      url: 'https://spanishtaxai.com/#pricing',
      support_email: 'support@spanishtaxai.com',
      description: 'Complete asynchronous review of your DNV application package — full audit delivered by email within 48h. No phone calls.',
    },
    premium: {
      name: 'Premium Concierge',
      price: '€99/month (founding €49.50/month)',
      url: 'https://spanishtaxai.com/#pricing',
      support_email: 'support@spanishtaxai.com',
      description: 'Ongoing async tax compliance — quarterly Modelo 130/303 review, Modelo 720/721 monitoring, priority email support within 24h.',
    },
  };
  return products[productKey] || products.pro_review;
}

