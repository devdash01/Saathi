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

// Common word dictionary for natural, spoken Hinglish spelling
const COMMON_DEV_WORDS: Record<string, string> = {
  // Conversational Pronouns (Formal Hindi 'वह'/'यह' spoken as 'wo'/'ye')
  'वह': 'wo',
  'वो': 'wo',
  'वे': 'wo',
  'यह': 'ye',
  'ये': 'ye',
  'उसने': 'usne',
  'उसको': 'usko',
  'उसे': 'use',
  'उसका': 'uska',
  'उसकी': 'uski',
  'उसके': 'uske',
  'इसने': 'isne',
  'इसको': 'isko',
  'इसे': 'ise',
  'इसका': 'iska',
  'इसकी': 'iski',
  'इसके': 'iske',
  'उन्होंने': 'unhone',
  'उन्हें': 'unhein',
  'उनका': 'unka',
  'उनकी': 'unki',
  'उनके': 'unke',
  'इन्होंने': 'inhone',
  'इन्हें': 'inhein',
  'इनका': 'inka',
  'इनकी': 'inki',
  'इनके': 'inke',
  'मैं': 'main',
  'मै': 'main',
  'मैंने': 'maine',
  'मैने': 'maine',
  'मुझे': 'mujhe',
  'हमे': 'humein',
  'हमें': 'humein',
  'हम': 'hum',
  'हमने': 'humne',
  'हमारा': 'hamara',
  'हमारी': 'hamari',
  'हमारे': 'hamare',
  'मेरा': 'mera',
  'मेरी': 'meri',
  'मेरे': 'mere',
  'तू': 'tu',
  'तूने': 'tune',
  'तेरा': 'tera',
  'तेरी': 'teri',
  'तेरे': 'tere',
  'तुझे': 'tujhe',
  'तुम': 'tum',
  'तुमने': 'tumne',
  'तुम्हारा': 'tumhara',
  'तुम्हारी': 'tumhari',
  'तुम्हारे': 'tumhare',
  'तुम्हें': 'tumhein',
  'आप': 'aap',
  'आपने': 'aapne',
  'आपका': 'aapka',
  'आपकी': 'aapki',
  'आपके': 'aapke',
  'आपको': 'aapko',

  // Prepositions & Connectors
  'और': 'aur',
  'भी': 'bhi',
  'तो': 'to',
  'को': 'ko',
  'से': 'se',
  'ने': 'ne',
  'में': 'mein',
  'पर': 'par',
  'का': 'ka',
  'की': 'ki',
  'के': 'ke',
  'तक': 'tak',
  'साथ': 'saath',
  'पास': 'paas',
  'दूर': 'door',
  'अंदर': 'andar',
  'ऊपर': 'upar',
  'नीचे': 'neeche',
  'सामने': 'saamne',

  // Question & Adverb Words
  'क्या': 'kya',
  'क्यों': 'kyun',
  'क्यूँ': 'kyun',
  'कहाँ': 'kahan',
  'यहाँ': 'yahan',
  'वहाँ': 'wahan',
  'कैसे': 'kaise',
  'कैसा': 'kaisa',
  'कैसी': 'kaisi',
  'कौन': 'kaun',
  'कब': 'kab',
  'तब': 'tab',
  'जब': 'jab',
  'अब': 'ab',
  'सब': 'sab',
  'बहुत': 'bahut',
  'थोड़ा': 'thoda',
  'ज़्यादा': 'zyada',
  'ज्यादा': 'zyada',
  'कम': 'kam',
  'कोई': 'koi',
  'कुछ': 'kuch',

  // Polar & Affirmation Words
  'नहीं': 'nahi',
  'नही': 'nahi',
  'ना': 'na',
  'हाँ': 'haan',
  'हां': 'haan',
  'ठीक': 'theek',

  // Common Verbs & Auxiliaries
  'है': 'hai',
  'हैं': 'hain',
  'था': 'tha',
  'थी': 'thi',
  'थे': 'the',
  'हो': 'ho',
  'होगा': 'hoga',
  'होगी': 'hogi',
  'होंगे': 'honge',
  'कर': 'kar',
  'करो': 'karo',
  'करना': 'karna',
  'करता': 'karta',
  'करती': 'karti',
  'करते': 'karte',
  'रहा': 'raha',
  'रही': 'rahi',
  'रहे': 'rahe',
  'सकता': 'sakta',
  'सकती': 'sakti',
  'सकते': 'sakte',
  'आया': 'aaya',
  'आई': 'aayi',
  'आयी': 'aayi',
  'आए': 'aaye',
  'गया': 'gaya',
  'गई': 'gayi',
  'गयी': 'gayi',
  'गए': 'gaye',
  'आओ': 'aao',
  'जाओ': 'jao',
  'जा': 'ja',
  'आ': 'aa',
  'ले': 'le',
  'लो': 'lo',
  'लेकर': 'lekar',
  'दो': 'do',
  'दे': 'de',
  'दिया': 'diya',
  'दी': 'di',
  'भेजो': 'bhejo',
  'भेज': 'bhej',
  'बोल': 'bol',
  'बोलो': 'bolo',
  'बात': 'baat',
  'सुन': 'sun',
  'सुनो': 'suno',
  'देख': 'dekh',
  'देखो': 'dekho',
  'देखा': 'dekha',
  'रोक': 'rok',
  'रोको': 'roko',
  'भाग': 'bhaag',
  'भागो': 'bhaago',
  'दौड़': 'daud',
  'मदद': 'madad',
  'चाहिए': 'chahiye',
  'बचाओ': 'bachao',
  'काट': 'kaat',
  'देंगे': 'denge',
  'मार': 'maar',
  'मारपीट': 'maarpeet',
  'धमकी': 'dhamki',
  'जबरदस्ती': 'zabardasti',
  'छेड़छाड़': 'chhedchhad',
  'पीछा': 'peecha',
  'डर': 'dar',
  'लग': 'lag',
  'खतरा': 'khatra',
  'खून': 'khoon',
  'चोट': 'chot',
  'चाकू': 'chaku',
  'बंदूक': 'bandook',
  'हथियार': 'hathiyar',
  'शराब': 'sharaab',
  'नशा': 'nasha',
  'दहेज': 'dahej',

  // Nouns & Relations
  'दीदी': 'didi',
  'भैया': 'bhaiya',
  'भाई': 'bhai',
  'पति': 'pati',
  'पत्नी': 'patni',
  'सास': 'saas',
  'ससुर': 'sasur',
  'बच्चा': 'bachcha',
  'बच्चे': 'bachche',
  'आदमी': 'aadmi',
  'औरत': 'aurat',
  'लड़का': 'ladka',
  'लड़की': 'ladki',
  'लोग': 'log',
  'घर': 'ghar',
  'बाहर': 'bahar',
  'दरवाजा': 'darwaza',
  'कमरा': 'kamra',
  'बंद': 'band',
  'जल्दी': 'jaldi',
  'सड़क': 'sadak',
  'गली': 'gali',
  'रास्ता': 'raasta',
  'गाड़ी': 'gaadi',
  'फोन': 'phone',
  'जान': 'jaan',
  'पुलिस': 'police',
  'एम्बुलेंस': 'ambulance',
  'एंबुलेंस': 'ambulance',
  'अस्पताल': 'hospital',
  'पश्चिम': 'paschim',
  'विहार': 'vihar',
  'रोहिणी': 'rohini',
  'द्वारका': 'dwarka',
  'दिल्ली': 'delhi',
  'मेट्रो': 'metro'
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
