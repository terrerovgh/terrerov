export const site = {
  name: 'Terrerov',
  legalName: 'Terrerov Studio',
  url: 'https://www.terrerov.com',
  email: 'hola@terrerov.com',
  locale: 'en_US',
  localeAlt: 'es_US',
  region: 'US-KY',
  placename: 'Louisville',
  title: 'Terrerov — Web design for small businesses | Louisville, KY',
  description:
    'Independent web design studio for small businesses and companies. Custom websites, local SEO, booking systems, and ongoing care. English & Español. Based in Louisville, Kentucky.',
  tagline: 'Websites that bring in customers',
  locationLine: 'Louisville, Kentucky · Remote across the U.S.',
} as const;

export const services = [
  {
    n: '01',
    title: 'Custom website design & development',
    titleEs: 'Diseño y desarrollo web a medida',
    body: 'Sites built from scratch around your business — structure, copy, design, and code. No template with a logo swap. Fast, accessible, and ready for Google.',
  },
  {
    n: '02',
    title: 'Conversion-focused pages',
    titleEs: 'Páginas pensadas para convertir',
    body: 'Clear offers, strong calls to action, mobile-first layouts, and copy written for how people search and buy in your area.',
  },
  {
    n: '03',
    title: 'Local SEO & Google presence',
    titleEs: 'SEO local y presencia en Google',
    body: 'Business profiles, location pages, and technical foundations so neighbors find you — maps, reviews, and rankings that matter locally.',
  },
  {
    n: '04',
    title: 'Online booking & lead capture',
    titleEs: 'Reservas online y captación de leads',
    body: 'Appointment systems, contact forms, deposits, and calendar integrations that cut phone tag and fill your schedule.',
  },
  {
    n: '05',
    title: 'E-commerce for small catalogs',
    titleEs: 'Tienda online para catálogos pequeños',
    body: 'Sell products or services with clean checkout, inventory you can actually manage, and a storefront that matches your brand.',
  },
  {
    n: '06',
    title: 'Care plans & monthly updates',
    titleEs: 'Mantenimiento y actualizaciones',
    body: 'Hosting guidance, security, content changes, and small improvements after launch — so the site does not go stale the week it goes live.',
  },
] as const;

export const clients = [
  {
    title: 'Local shops & studios',
    body: 'Tattoo studios, salons, barbershops, boutiques — visual work that needs a gallery and easy booking.',
  },
  {
    title: 'Restaurants & hospitality',
    body: 'Menus, hours, reservations, and a presence that matches the experience in the room.',
  },
  {
    title: 'Professional services',
    body: 'Clinics, contractors, consultants, and firms that need trust, clarity, and qualified inquiries.',
  },
  {
    title: 'Growing companies',
    body: 'Teams that outgrew a DIY site or template and need something faster, clearer, and easier to maintain.',
  },
] as const;

export const process = [
  {
    n: '01',
    title: 'Listen',
    body: 'A short call about your business, customers, competition, and what a successful site must do in the first 90 days.',
  },
  {
    n: '02',
    title: 'Plan & design',
    body: 'Sitemap, structure, and visual direction you approve before development. No surprises at launch.',
  },
  {
    n: '03',
    title: 'Build',
    body: 'Clean code, mobile performance, SEO foundations, forms, and integrations. Most projects launch in 2–4 weeks.',
  },
  {
    n: '04',
    title: 'Launch & grow',
    body: 'Training, analytics, and optional monthly care so the site keeps earning after day one.',
  },
] as const;

export const deliverables = [
  'Custom design (not a theme reskin)',
  'Mobile-first, fast-loading pages',
  'SEO-ready structure & metadata',
  'Contact / booking forms that work',
  'English and/or Spanish content',
  'Training so you can update basics',
  'Analytics setup (traffic & leads)',
  'Optional hosting & care plan',
] as const;

export const faqs = [
  {
    q: 'How much does a website cost?',
    a: 'Most small-business sites fall in a clear fixed range once we define scope. After a short call I send a written quote — no hourly surprises. Smaller brochure sites start lower; booking, multi-location, or e-commerce projects cost more.',
  },
  {
    q: 'How long does a project take?',
    a: 'Typical timeline is 2–4 weeks from kickoff to launch, depending on content readiness and feedback speed. You always know the next step.',
  },
  {
    q: 'Do you work in Spanish?',
    a: 'Yes. I design, write, and deliver fully in English, fully in Spanish, or bilingual. Many clients in Louisville and across the U.S. need both.',
  },
  {
    q: 'Can you redesign an existing site?',
    a: 'Absolutely. I audit what is working, what is hurting conversions or search, and rebuild with a clearer structure — often keeping your domain, email, and brand assets.',
  },
  {
    q: 'What do you need from me to start?',
    a: 'A short conversation, examples of sites you like, your services/pricing if public, photos or a plan to shoot them, and goals for the first 90 days. I handle the rest.',
  },
  {
    q: 'Do you offer hosting and updates after launch?',
    a: 'Yes. I can recommend or manage hosting and offer monthly care plans for content changes, security, and small improvements.',
  },
] as const;

export const survivingChernarus = {
  kicker: 'Featured personal project',
  title: 'Surviving Chernarus',
  logoAlt: 'Surviving Chernarus — gas-mask survivor mark over a sun disk',
  lede:
    'A personal <strong>life OS</strong>: gamified productivity, AI agents as a second brain, and a self-hosted “Beacon” on Raspberry Pi + laptop Kubernetes — not a product for sale, but the lab where the craft lives.',
  body:
    'Hotspot, proxy, Radio Chernarus, n8n automation, secure access, and a command hub — all wrapped in survival lore so systems work stays motivating. The same rigor (networks, automation, interfaces, narrative) informs client work at Terrerov.',
  pillars: [
    {
      n: '01',
      title: 'Beacon infrastructure',
      body: 'RPi 5 master + Lenovo worker (K3s), Docker services, Pi-hole, Squid, captive portal, client certs.',
    },
    {
      n: '02',
      title: 'Radio & agents',
      body: 'Icecast stream, AI DJ, NotebookLM podcasts, n8n + Telegram as the nervous system of the refugio.',
    },
    {
      n: '03',
      title: 'Life RPG layer',
      body: 'Missions from calendar/tasks, XP & rewards, tactical city map, context DB for a personal coach.',
    },
    {
      n: '04',
      title: 'Guardian perimeter',
      body: 'Logs, secrets discipline, vulnerability watch, and privacy-first handling of personal data.',
    },
  ],
  repoUrl: 'https://github.com/terrerovgh/surviving-chernarus',
  repoLabel: 'View on GitHub',
  ctaLabel: 'Talk about systems work',
} as const;

export const nav = [
  { href: '#about', label: 'About' },
  { href: '#chernarus', label: 'Project' },
  { href: '#services', label: 'Services' },
  { href: '#clients', label: 'Audience' },
  { href: '#process', label: 'Process' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contact', label: 'Contact' },
] as const;
