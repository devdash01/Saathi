/**
 * SAATHI Devanagari to Roman Hinglish Phonetic Transliterator
 * Ensures that all transcribed emergency speech displays in clean, readable Roman Hinglish
 * (e.g. "मदद चाहिए मुझे" -> "madad chahiye mujhe")
 */

const DEVANAGARI_MAP: Record<string, string> = {
  // Vowels
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'अं': 'an', 'अः': 'ah',

  // Matras (Vowel signs)
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '',

  // Consonants
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h',

  // Nuqta consonants (Common in Hindustani/Urdu loanwords)
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r',
  'ढ़': 'rh', 'फ़': 'f'
};

// Common word dictionary for instant natural Hinglish spelling
const COMMON_DEV_WORDS: Record<string, string> = {
  'मदद': 'madad',
  'चाहिए': 'chahiye',
  'पुलिस': 'police',
  'एम्बुलेंस': 'ambulance',
  'एंबुलेंस': 'ambulance',
  'अस्पताल': 'hospital',
  'गाड़ी': 'gaadi',
  'बचाओ': 'bachao',
  'खून': 'khoon',
  'चोट': 'chot',
  'चाकू': 'chaku',
  'बंदूक': 'bandook',
  'मार': 'maar',
  'रहा': 'raha',
  'रही': 'rahi',
  'रहे': 'rahe',
  'है': 'hai',
  'हैं': 'hain',
  'था': 'tha',
  'थी': 'thi',
  'थे': 'the',
  'मुझे': 'mujhe',
  'हमे': 'humein',
  'हमें': 'humein',
  'मेरा': 'mera',
  'मेरी': 'meri',
  'मेरे': 'mere',
  'पीछे': 'peeche',
  'घर': 'ghar',
  'बाहर': 'bahar',
  'दरवाजा': 'darwaza',
  'कमरा': 'kamra',
  'बंद': 'band',
  'जल्दी': 'jaldi',
  'आओ': 'aao',
  'भेजो': 'bhejo',
  'कोई': 'koi',
  'पश्चिम': 'paschim',
  'विहार': 'vihar',
  'रोहिणी': 'rohini',
  'द्वारका': 'dwarka',
  'दिल्ली': 'delhi',
  'मेट्रो': 'metro',
  'सड़क': 'sadak',
  'गली': 'gali',
  'रास्ता': 'raasta',
  'खतरा': 'khatra',
  'डर': 'dar',
  'लग': 'lag',
  'फोन': 'phone',
  'काट': 'kaat',
  'देंगे': 'denge',
  'बच्चा': 'bachcha',
  'बच्चे': 'bachche',
  'जान': 'jaan'
};

/**
 * Checks if a string contains any Devanagari characters
 */
export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Transliterates Devanagari text to natural Roman Hinglish
 */
export function devanagariToHinglish(text: string): string {
  if (!text || !containsDevanagari(text)) return text;

  // Split into words and check dictionary first for speed and natural spelling
  const words = text.split(/\s+/);
  const outWords = words.map((w) => {
    // Remove punctuation around word
    const cleaned = w.replace(/^[^\u0900-\u097F]+|[^\u0900-\u097F]+$/g, '');
    const prefix = w.slice(0, w.indexOf(cleaned));
    const suffix = w.slice(w.indexOf(cleaned) + cleaned.length);

    if (COMMON_DEV_WORDS[cleaned]) {
      return prefix + COMMON_DEV_WORDS[cleaned] + suffix;
    }

    // Character-by-character phonetic conversion
    let res = '';
    const chars = Array.from(cleaned);
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const next = chars[i + 1];

      if (DEVANAGARI_MAP[c] !== undefined) {
        res += DEVANAGARI_MAP[c];
        // Add inherent 'a' sound for consonants if not followed by a matra or virama
        const isConsonant = /[\u0915-\u0939]/.test(c);
        const isNextMatra = next && /[\u093E-\u094D]/.test(next);
        if (isConsonant && !isNextMatra && i < chars.length - 1) {
          res += 'a';
        }
      } else {
        res += c;
      }
    }
    return prefix + (res || cleaned) + suffix;
  });

  return outWords.join(' ');
}
