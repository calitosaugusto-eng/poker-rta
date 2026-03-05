import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pokerrta.app',
  appName: 'Poker RTA',
  webDir: 'out',
  server: {
    // Permitir carregar recursos da Vercel
    allowNavigation: ['poker-rta.vercel.app', '*.vercel.app'],
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    // Configuração do ScreenCapture
    ScreenCapture: {
      requestPermissions: true,
    },
  },
};

export default config;
