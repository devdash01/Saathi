/**
 * SAATHI Real-Time Emergency Keyword Highlighter
 * Automatically parses caller transcript on every word or pause
 * and tags critical distress tokens (Threats, Medical, Agencies, Locations)
 */

export interface HighlightedSegment {
  text: string;
  isKeyword: boolean;
  category?: 'threat' | 'medical' | 'agency' | 'location';
  label?: string;
  badgeColor?: string;
}

// Emergency Keyword Definitions (Both Hinglish & Devanagari)
export const EMERGENCY_KEYWORDS = [
  // 1. THREATS & WEAPONS (RED)
  { words: ['chaku', 'knife', 'chaaku', 'चाकू'], category: 'threat', label: 'WEAPON (Knife)', color: '#dc2626' },
  { words: ['bandook', 'gun', 'pistol', 'hathiyar', 'weapon', 'बंदूक', 'हथियार'], category: 'threat', label: 'WEAPON (Firearm)', color: '#dc2626' },
  { words: ['mar raha', 'maar raha', 'peet raha', 'beating', 'hitting', 'attack', 'hamla', 'mar dalega', 'मार रहा', 'हमला', 'जान का खतरा'], category: 'threat', label: 'ACTIVE VIOLENCE', color: '#dc2626' },
  { words: ['danda', 'lathi', 'rod', 'डंडा', 'लाठी'], category: 'threat', label: 'BLUNT WEAPON', color: '#dc2626' },
  { words: ['peechha', 'piche', 'stalking', 'following', 'peeche aa raha', 'पीछे', 'पीछा'], category: 'threat', label: 'STALKING / PURSUIT', color: '#dc2626' },
  { words: ['zabardasti', 'force', 'forced', 'chheen', 'जबरदस्ती'], category: 'threat', label: 'COERCION', color: '#dc2626' },
  { words: ['kidnap', 'abduction', 'le ja raha', 'auto ruk nahi raha', 'अपहरण'], category: 'threat', label: 'TRANSIT DIVERSION', color: '#dc2626' },
  { words: ['bahar khada', 'bahar aa gaya', 'darwaza tod', 'outside', 'perimeter', 'gate', 'दरवाजा', 'बाहर'], category: 'threat', label: 'PERIMETER BREACH', color: '#dc2626' },
  { words: ['chupke', 'whisper', 'sun lega', 'dheere', 'चुपके'], category: 'threat', label: 'SPEECH SUPPRESSION', color: '#9333ea' },
  { words: ['bachcha', 'bacche', 'child', 'minor', 'baby', 'beti', 'beta', 'बच्चा', 'बच्चे'], category: 'threat', label: 'CHILD AT RISK', color: '#ea580c' },
  { words: ['aag', 'fire', 'dhuan', 'smoke', 'aag lag gayi', 'ब्लास्ट', 'आग'], category: 'threat', label: 'FIRE HAZARD', color: '#dc2626' },
  { words: ['danger', 'khatra', 'urgent', 'emergency', 'jaldi', 'खतरा', 'इमरजेंसी'], category: 'threat', label: 'CRITICAL THREAT', color: '#dc2626' },

  // 2. MEDICAL & INJURIES (AMBER / ORANGE)
  { words: ['accident', 'accident ho gaya', 'gadi takra gayi', 'takkar', 'दुर्घटना', 'एक्सीडेंट'], category: 'medical', label: 'VEHICLE CRASH / TRAUMA', color: '#d97706' },
  { words: ['khoon', 'blood', 'bleeding', 'nikal raha', 'खून'], category: 'medical', label: 'BLEEDING', color: '#d97706' },
  { words: ['chot', 'injury', 'hurt', 'wound', 'chot lagi', 'चोट'], category: 'medical', label: 'PHYSICAL INJURY', color: '#d97706' },
  { words: ['behosh', 'unconscious', 'fainted', 'बेहोश'], category: 'medical', label: 'UNCONSCIOUS', color: '#d97706' },
  { words: ['dard', 'pain', 'saans', 'breathing', 'chhati', 'chest', 'chest pain', 'दर्द'], category: 'medical', label: 'ACUTE DISTRESS', color: '#d97706' },
  { words: ['fracture', 'haddi', 'tuti', 'हड्डी'], category: 'medical', label: 'TRAUMA / FRACTURE', color: '#d97706' },

  // 3. EMERGENCY AGENCIES & DISTRESS CALLS (BLUE)
  { words: ['madad', 'help', 'bachao', 'save', 'koi hai', 'मदद', 'बचाओ', 'हेल्प'], category: 'agency', label: 'DISTRESS CRY', color: '#2563eb' },
  { words: ['police', 'pcr', '112', 'thana', 'policewala', 'police station', 'पुलिस', 'थाना'], category: 'agency', label: 'POLICE DISPATCH (112)', color: '#2563eb' },
  { words: ['ambulance', '108', 'hospital', 'doctor', 'aspataal', 'ward', 'icu', 'एम्बुलेंस', 'अस्पताल'], category: 'agency', label: 'MEDICAL DISPATCH (108)', color: '#0891b2' },
  { words: ['shelter', 'safehouse', '181', 'mahila', 'shelter home', 'महिला हेल्पलाइन'], category: 'agency', label: 'SAFE SHELTER (181)', color: '#059669' },

  // 4. LOCATIONS & CRITICAL LANDMARKS (GREEN)
  { words: ['paschim vihar', 'rohini', 'dwarka', 'delhi', 'noida', 'gurugram', 'lucknow', 'central delhi', 'ekta apartment', 'ekta apartments', 'पश्चिम विहार', 'रोहिणी'], category: 'location', label: 'LOCALITY', color: '#16a34a' },
  { words: ['metro', 'metro station', 'station', 'bus stand', 'chowk', 'red light', 'flyover', 'मेट्रो', 'चौक'], category: 'location', label: 'LANDMARK', color: '#16a34a' },
  { words: ['road', 'sadak', 'gali', 'sector', 'block', 'apartment', 'house', 'सड़क', 'गली'], category: 'location', label: 'ADDRESS BEAT', color: '#16a34a' }
];

/**
 * Tokenizes text and produces an array of segments with matched emergency badges
 */
export function parseEmergencyKeywords(text: string): {
  segments: HighlightedSegment[];
  detectedKeywords: Array<{ label: string; category: string; color: string; word: string }>;
} {
  if (!text || text.trim().length === 0) {
    return { segments: [], detectedKeywords: [] };
  }

  // Build sorted list of all search terms (longer phrases first to avoid greedy substring collisions)
  const patternList: Array<{ word: string; category: 'threat' | 'medical' | 'agency' | 'location'; label: string; color: string }> = [];

  for (const def of EMERGENCY_KEYWORDS) {
    for (const w of def.words) {
      patternList.push({
        word: w.toLowerCase(),
        category: def.category as any,
        label: def.label,
        color: def.color
      });
    }
  }

  // Sort by length descending
  patternList.sort((a, b) => b.word.length - a.word.length);

  // Match words using word boundaries where possible or direct substring for multi-word
  const escapedTerms = patternList.map((p) => p.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  const parts = text.split(regex);
  const segments: HighlightedSegment[] = [];
  const detectedKeywordsMap = new Map<string, { label: string; category: string; color: string; word: string }>();

  for (const part of parts) {
    if (!part) continue;
    const lower = part.toLowerCase();
    const match = patternList.find((p) => p.word === lower);

    if (match) {
      segments.push({
        text: part,
        isKeyword: true,
        category: match.category,
        label: match.label,
        badgeColor: match.color
      });
      detectedKeywordsMap.set(match.label, {
        label: match.label,
        category: match.category,
        color: match.color,
        word: part
      });
    } else {
      segments.push({
        text: part,
        isKeyword: false
      });
    }
  }

  return {
    segments,
    detectedKeywords: Array.from(detectedKeywordsMap.values())
  };
}
