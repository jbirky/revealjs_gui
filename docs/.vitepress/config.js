import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Slides Editor',
  description: 'A self-hostable WYSIWYG presentation editor powered by reveal.js',
  base: '/revealjs_gui/',
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/overview' },
      { text: 'Tutorials', link: '/tutorials/first-presentation' },
      { text: 'GitHub', link: 'https://github.com/jbirky/revealjs_gui' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' }
          ]
        }
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/features/overview' },
            { text: 'Text & Formatting', link: '/features/text-formatting' },
            { text: 'Shapes & Elements', link: '/features/shapes' },
            { text: 'LaTeX & Math', link: '/features/latex' },
            { text: 'Charts', link: '/features/charts' },
            { text: 'Export & Sharing', link: '/features/export' }
          ]
        }
      ],
      '/tutorials/': [
        {
          text: 'Tutorials',
          items: [
            { text: 'Your First Presentation', link: '/tutorials/first-presentation' },
            { text: 'Academic Slides', link: '/tutorials/academic-slides' },
            { text: 'Using LaTeX & Math', link: '/tutorials/using-latex' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jbirky/revealjs_gui' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Jessica Birky'
    },

    search: {
      provider: 'local'
    }
  }
})
