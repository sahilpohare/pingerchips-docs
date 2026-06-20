// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Pingerchips',
  tagline: 'Realtime as crisp as chips',
  favicon: 'img/favicon.ico',

  url: 'https://docs.pingerchips.com',
  baseUrl: '/',

  organizationName: 'sahilpohare',
  projectName: 'pingerchips-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.jpg',
      mermaid: {
        theme: { light: 'neutral', dark: 'dark' },
      },
      navbar: {
        title: 'Pingerchips',
        logo: {
          alt: 'Pingerchips Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://pingerchips.com',
            label: 'pingerchips.com',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/docs/getting-started' },
              { label: 'Chat / Sessions', to: '/docs/chat/intro' },
              { label: 'Durable Objects', to: '/docs/durable-objects/intro' },
              { label: 'Spaces', to: '/docs/spaces/intro' },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'pingerchips.com', href: 'https://pingerchips.com' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Pingerchips.`,
      },
      prism: {
        additionalLanguages: ['elixir', 'bash'],
      },
    }),
};

module.exports = config;
