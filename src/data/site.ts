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
    'Independent web design studio for small businesses. Custom websites, local SEO, booking, and care. English & Español. Louisville, Kentucky.',
  tagline: 'Sites that grow business',
  lede: 'Custom websites for small businesses — designed carefully, built fast, made to bring in customers. Drag the curtain: it is a live QR to this studio.',
  locationLine: 'Louisville, KY · Remote U.S. · EN / ES',
  timeline: '2–4 weeks typical',
  githubLab: 'https://github.com/terrerovgh/surviving-chernarus',
} as const;

/** Short labels only — one-screen density */
export const services = [
  'Custom design & build',
  'Conversion pages',
  'Local SEO',
  'Booking & leads',
  'Small e-commerce',
  'Care plans',
] as const;

export const process = ['Listen', 'Plan', 'Build', 'Launch'] as const;

export const facts = [
  'Fixed-scope quotes',
  'English · Español',
  'Direct with the builder',
] as const;
