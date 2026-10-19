import type { CapacitorConfig } from '@capacitor/cli';

/**
 * OVER-THE-AIR (OTA) LIVE UPDATE CONFIGURATION:
 * 
 * To push live UI/code updates directly to the APK without reinstalling:
 * 1. Deploy your app: npm run deploy:web (or deploy to Vercel/Netlify)
 * 2. Set your live Vercel URL below in LIVE_URL (or via CAPACITOR_SERVER_URL env var)
 * 3. Run: npm run cap:sync
 * 
 * Once compiled with this URL, any time you push new design/code changes to Vercel,
 * the APK automatically loads the newest version on launch over mobile data or Wi-Fi!
 */
const LIVE_URL = 'https://saathi-tawny-theta.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.saathi.emergency',
  appName: 'Saathi',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    ...(LIVE_URL ? { url: LIVE_URL, cleartext: false } : {})
  }
};

export default config;
