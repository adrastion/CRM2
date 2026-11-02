import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.profsportcrm.app',
  appName: 'ПРОФСПОРТСРМ',
  webDir: 'build',
  server: {
    // https scheme нужен для Secure Context (localStorage, SW, push)
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0B1F3A',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
