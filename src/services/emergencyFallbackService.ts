/**
 * Emergency Fallback Service for Zero-Internet / Offline Scenarios
 * Implements Section 5 of SAATHI Master Specification:
 * - Direct 112 telephone handoff
 * - Verified SMS fallback with native prefilled template
 * - Verified public emergency helpline directory (India)
 * - Offline life-safety instructions
 * - Truthful disclaimers regarding platform limitations
 */

export interface VerifiedHelpline {
  number: string;
  name: string;
  category: 'police' | 'medical' | 'women' | 'child' | 'disaster';
  description: string;
  is24x7: boolean;
}

export const VERIFIED_INDIAN_HELPLINES: VerifiedHelpline[] = [
  {
    number: '112',
    name: 'National Emergency Helpline (ERSS)',
    category: 'police',
    description: 'All-in-one national emergency response for Police, Fire, and Medical emergencies in India.',
    is24x7: true
  },
  {
    number: '108',
    name: 'Emergency Medical & Ambulance Relief',
    category: 'medical',
    description: '24/7 Free emergency ambulance dispatch and trauma care transfer.',
    is24x7: true
  },
  {
    number: '1091',
    name: 'Women in Distress Police Helpline',
    category: 'women',
    description: 'Dedicated police response units for harassment, assault, and domestic violence.',
    is24x7: true
  },
  {
    number: '181',
    name: 'National Women Helpline (Sakhi OSC)',
    category: 'women',
    description: 'Support, emergency shelter allocation, and legal aid for women in crisis.',
    is24x7: true
  },
  {
    number: '1098',
    name: 'CHILDLINE India',
    category: 'child',
    description: 'Emergency response, care, and protection service for children in distress.',
    is24x7: true
  },
  {
    number: '1077',
    name: 'Disaster Management Control Room',
    category: 'disaster',
    description: 'District level disaster management, floods, building collapses, and earthquakes.',
    is24x7: true
  }
];

export const OFFLINE_LIFE_SAFETY_INSTRUCTIONS = [
  {
    title: 'Immediate Physical Cover',
    detail: 'Move into a secure room with a sturdy lock or interior bolt. Turn off lights if someone is outside.'
  },
  {
    title: 'Silent Phone Protocol',
    detail: 'Mute ringers and vibrations immediately. Keep screen brightness at minimum to avoid revealing your position.'
  },
  {
    title: 'Direct 112 Telephone Call',
    detail: 'Even without cellular data/internet, your phone can connect to 112 if ANY network tower has signal (Emergency Calls Only mode).'
  },
  {
    title: 'Power Conservation',
    detail: 'Close background apps and enable Battery Saver. Do not make multiple calls unless necessary.'
  }
];

/**
 * Generate prefilled emergency SMS link
 */
export function generateEmergencySmsLink(
  recipient: string = '112',
  situationSummary: string = 'Urgent assistance requested',
  locationDetails: string = 'Location unknown',
  timeString: string = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
): { smsUrl: string; formattedMessage: string } {
  const formattedMessage = `EMERGENCY ASSISTANCE REQUESTED.\nSituation: ${situationSummary}\nApproximate Location: ${locationDetails}\nTime: ${timeString}\nPlease contact me immediately.`;
  // Standard RFC 5724 sms uri
  const encodedBody = encodeURIComponent(formattedMessage);
  const smsUrl = `sms:${recipient}?body=${encodedBody}`;

  return { smsUrl, formattedMessage };
}
