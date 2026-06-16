import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html for reference
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Bdarija',
    description: 'Translate any webpage into Moroccan Darija.',
    version: '1.0.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['http://localhost/*'],
    icons: {
      '16': 'logo.png',
      '32': 'logo.png',
      '48': 'logo.png',
      '128': 'logo.png'
    },
    action: {
      default_title: 'Bdarija Translator',
      default_icon: 'logo.png'
    }
  }
});
