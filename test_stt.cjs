const https = require('https');
const fs = require('fs');

async function main() {
  console.log('1. Requesting TTS from Sarvam API...');
  const ttsPayload = JSON.stringify({
    text: 'दीदी, वह घर के बाहर आ गया है... मेरा बच्चा भी मेरे साथ है। मैं ज़्यादा देर बात नहीं कर सकती।',
    target_language_code: 'hi-IN',
    speaker: 'kavya_hi_conversational',
    model: 'bulbul:v4-flash'
  });

  const ttsRes = await new Promise((resolve, reject) => {
    const req = https.request('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': 'sk_j0aml6s8_dl4vBRupcAFUxw0IwO8qIYjU'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(ttsPayload);
    req.end();
  });

  const audioBase64 = ttsRes.audios[0];
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  fs.writeFileSync('sarvam_distress_call.wav', audioBuffer);
  console.log('2. Audio received from Sarvam TTS, saved to sarvam_distress_call.wav, bytes:', audioBuffer.length);

  console.log('3. Sending audio to Sarvam Speech-to-Text (STT) API with mode=translate...');
  const boundary = '----SarvamBoundary' + Date.now();
  const body = Buffer.concat([
    Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaaras:v4\r\n'),
    Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="mode"\r\n\r\ntranslate\r\n'),
    Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n'),
    audioBuffer,
    Buffer.from('\r\n--' + boundary + '--\r\n')
  ]);

  const sttRes = await new Promise((resolve, reject) => {
    const req = https.request('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length,
        'api-subscription-key': 'sk_j0aml6s8_dl4vBRupcAFUxw0IwO8qIYjU'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  console.log('4. STT HTTP Status:', sttRes.status);
  console.log('5. STT Output:', sttRes.body);
}

main().catch(console.error);
