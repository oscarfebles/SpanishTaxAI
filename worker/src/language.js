/**
 * Language detection — heuristic, no external libs.
 * Returns one of: 'en', 'es', 'fr', 'de', 'it', 'pt', 'unknown'.
 *
 * Method: counts frequency-weighted matches of high-frequency function words
 * per language. Good enough for short chat messages (>5 words). Not designed
 * for perfect accuracy on 1-word inputs — for those, returns 'en' as default.
 */

const LANG_MARKERS = {
  en: [
    'the', 'and', 'is', 'to', 'of', 'in', 'i', 'you', 'a', 'have',
    'do', 'can', 'my', 'with', 'this', 'that', 'for', 'on', 'at', 'be',
  ],
  es: [
    'el', 'la', 'los', 'las', 'de', 'y', 'es', 'que', 'en', 'un',
    'una', 'por', 'para', 'con', 'qué', 'cómo', 'cuándo', 'mi', 'tengo', 'soy',
    'necesito', 'puedo', 'pero', 'también',
  ],
  fr: [
    'le', 'la', 'les', 'de', 'du', 'et', 'est', 'que', 'qui', 'en',
    'un', 'une', 'pour', 'avec', 'mon', 'ma', 'mes', 'je', 'tu', 'vous',
    'comment', 'quand', 'pourquoi', 'aussi',
  ],
  de: [
    'der', 'die', 'das', 'und', 'ist', 'ich', 'du', 'sie', 'mit', 'für',
    'ein', 'eine', 'auf', 'zu', 'wie', 'wann', 'warum', 'aber', 'nicht', 'auch',
  ],
  it: [
    'il', 'la', 'lo', 'i', 'gli', 'le', 'di', 'e', 'che', 'in',
    'un', 'una', 'per', 'con', 'sono', 'mio', 'mia', 'come', 'quando', 'perché',
  ],
  pt: [
    'o', 'a', 'os', 'as', 'de', 'e', 'que', 'em', 'um', 'uma',
    'para', 'com', 'meu', 'minha', 'sou', 'tenho', 'como', 'quando', 'porque', 'também',
  ],
};

export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'unknown';

  // Normalize: lowercase, strip punctuation, split into words
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'unknown';
  // Too few words → unreliable, default to English (since site is in English)
  if (words.length < 3) return 'en';

  const scores = {};
  for (const lang of Object.keys(LANG_MARKERS)) {
    const markers = LANG_MARKERS[lang];
    let count = 0;
    for (const word of words) {
      if (markers.includes(word)) count++;
    }
    scores[lang] = count / words.length;
  }

  // Find the highest-scoring language
  let bestLang = 'en';
  let bestScore = scores.en;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestLang = lang;
      bestScore = score;
    }
  }

  // If no language scored above 5% match rate, fall back to 'unknown'
  if (bestScore < 0.05) return 'unknown';

  return bestLang;
}

/**
 * Returns a friendly language name from the ISO code.
 * Used in the bot's offer-to-switch message.
 */
export function languageName(code) {
  const names = {
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    en: 'English',
    unknown: 'your language',
  };
  return names[code] || code;
}
