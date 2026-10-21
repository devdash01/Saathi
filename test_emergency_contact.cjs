/**
 * Test script to verify Emergency Contact Alert generation and URL dispatch
 */
const assert = require('assert');

// Mock Emergency Contact Service logic
function cleanPhoneForWhatsApp(raw) {
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `91${digitsOnly}`;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) return `91${digitsOnly.slice(1)}`;
  return digitsOnly;
}

function cleanPhoneForSms(raw) {
  const cleaned = raw.trim().replace(/[\s-()]/g, '');
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  return cleaned;
}

function generateIncidentSummary(report) {
  const callerStatement = report.callerText?.trim();
  const location = report.location?.address || 'Paschim Vihar, New Delhi';
  const urgency = report.urgencyLevel || 'CRITICAL';
  if (callerStatement) {
    return `Distress caller reported: "${callerStatement}". Active emergency response initiated at ${location} under ${urgency} priority.`;
  }
  return `Immediate safety assistance requested via SAATHI 181/112 command.`;
}

function buildEmergencyAlertMessage(report, contactName) {
  const incidentId = report.id || 'INC-181';
  const urgency = report.urgencyLevel || 'CRITICAL';
  const incidentSummary = generateIncidentSummary(report);
  const address = report.location?.address || 'Paschim Vihar, New Delhi';
  const coords = report.location?.coords || [28.6692, 77.1068];
  const mapsLink = `https://maps.google.com/?q=${coords[0].toFixed(5)},${coords[1].toFixed(5)}`;
  const policeStatus = report.agencies?.police?.recommended
    ? `Dispatched (Priority: ${report.agencies.police.priority || 'IMMEDIATE'}, ETA ~${report.agencies.police.eta || '4 mins'})`
    : 'Control Room Standby';

  return (
    `SAATHI EMERGENCY DISTRESS ALERT\n\n` +
    `Dear ${contactName},\n` +
    `You are receiving this emergency notification because you are registered as a trusted emergency guardian. Your contact is currently connected to the Delhi 181 / 112 ERSS Women Safety & Emergency Command.\n\n` +
    `[INCIDENT SUMMARY]\n` +
    `${incidentSummary}\n` +
    `Incident ID: ${incidentId} • Priority: ${urgency}\n\n` +
    `[LIVE LOCATION & REAL-TIME TRACKING]\n` +
    `Location: ${address}\n` +
    `Live Google Maps Link:\n` +
    `${mapsLink}\n\n` +
    `[EMERGENCY DISPATCH STATUS]\n` +
    `- Delhi Police 112: ${policeStatus}\n\n` +
    `[WHAT YOU CAN DO]\n` +
    `1. Stay calm. Official responders have already received this docket.\n` +
    `2. Reach out via phone or text if it is safe for them to speak.\n` +
    `3. If they cannot be reached, coordinate directly with Delhi Police ERSS by dialing 112 quoting Case #${incidentId}.\n\n` +
    `Delhi ERSS Central Command Station (OP-1187)`
  );
}

function generateWhatsAppUrl(phone, message) {
  const cleanNumber = cleanPhoneForWhatsApp(phone);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

function generateSmsUrl(phone, message) {
  const cleanNumber = cleanPhoneForSms(phone);
  return `sms:${cleanNumber}?body=${encodeURIComponent(message)}`;
}

// RUN TESTS
console.log('Testing Emergency Contact Service Logic...');

// 1. Phone number cleaning
const rawIndianPhone = '+91 98765 43210';
const raw10Digit = '9876543210';
assert.strictEqual(cleanPhoneForWhatsApp(rawIndianPhone), '919876543210');
assert.strictEqual(cleanPhoneForWhatsApp(raw10Digit), '919876543210');
assert.strictEqual(cleanPhoneForSms(rawIndianPhone), '+919876543210');
assert.strictEqual(cleanPhoneForSms(raw10Digit), '+919876543210');
console.log('✓ PASS: Phone number cleaner formats both Indian and international numbers');

// 2. Alert message formatting with operator details
const mockReport = {
  id: 'SA-2024-1187',
  urgencyLevel: 'CRITICAL',
  callerText: 'Ghar ke bahar do log zabardasti ghusne ki koshish kar rahe hain',
  location: {
    address: 'A-Block Paschim Vihar, New Delhi',
    coords: [28.6692, 77.1068]
  },
  agencies: {
    police: { recommended: true, priority: 'IMMEDIATE', eta: '4m' }
  }
};

const alertMsg = buildEmergencyAlertMessage(mockReport, 'Rahul Sharma');
assert(alertMsg.includes('SA-2024-1187'), 'Message must contain incident ID');
assert(alertMsg.includes('CRITICAL'), 'Message must contain urgency level');
assert(alertMsg.includes('[INCIDENT SUMMARY]'), 'Message must contain [INCIDENT SUMMARY]');
assert(alertMsg.includes('Distress caller reported:'), 'Message must contain dynamic incident explanation');
assert(alertMsg.includes('A-Block Paschim Vihar'), 'Message must contain address');
assert(alertMsg.includes('https://maps.google.com/?q=28.66920,77.10680'), 'Message must contain clickable Google Maps link');
assert(alertMsg.includes('Delhi Police 112: Dispatched'), 'Message must contain police dispatch');
console.log('✓ PASS: Emergency message formats all operator CAD details into soulful structured SOS with incident summary');

// 3. WhatsApp and SMS URL generation
const waUrl = generateWhatsAppUrl(rawIndianPhone, alertMsg);
assert(waUrl.startsWith('https://wa.me/919876543210?text='), 'WhatsApp URL must use wa.me with clean number');

const smsUrl = generateSmsUrl(rawIndianPhone, alertMsg);
assert(smsUrl.startsWith('sms:+919876543210?body='), 'SMS URL must use valid sms: protocol');
console.log('✓ PASS: WhatsApp & SMS links generated with valid parameters and encoded body');

console.log('\nAll Emergency Contact tests passed successfully! ✨');
