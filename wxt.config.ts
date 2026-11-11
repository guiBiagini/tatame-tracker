import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tatame Tracker',
    description:
      'Acompanhe categoria, horário e tatame dos atletas da sua academia em campeonatos de Jiu-Jitsu.',
    permissions: ['storage', 'alarms', 'notifications', 'sidePanel'],
    // Só os hosts que os adaptadores consultam. Novas plataformas entram aqui.
    host_permissions: [
      'https://www.bjjcompsystem.com/*',
      'https://api.meucombate.com.br/*',
      'https://www.ilutas.com.br/*',
    ],
    action: { default_title: 'Tatame Tracker' },
  },
});
