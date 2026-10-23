import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.saivoiceos.assistant',
  appName: 'SAI Voice OS',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: { allowMixedContent: false },
};
export default config;
