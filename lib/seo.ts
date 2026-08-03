import { appBaseUrl } from './appUrl'

/**
 * What a search engine and a link preview see.
 *
 * The site shipped with no `<title>` on the landing page at all, no meta
 * description anywhere, no sitemap and no robots file — so Google had nothing
 * to show but the URL, and pasting the link into WhatsApp produced a bare
 * string. None of that is generated for you; it has to be written.
 *
 * The titles below are written around what a bakery owner actually types into
 * Google — "برنامج إدارة مخابز", "حساب تكلفة المنتج" — rather than around the
 * product's own vocabulary. Every one of them describes something the system
 * really does; a title that oversells is a bounce, and a bounce is worse for
 * ranking than never appearing.
 */

export const SITE_NAME = 'Bakex'

export interface PageSeo {
  title: string
  description: string
  /** Kept out of the index — login screens and anything behind auth. */
  noindex?: boolean
}

/** Under ~60 characters shows in full on Google; under ~155 for the description. */
export const PAGE_SEO = {
  home: {
    title: 'Bakex — برنامج إدارة المخابز والكافيهات | مخزون وتكاليف وكاشير',
    description:
      'نظام سعودي لإدارة المخابز: تتبّع المواد الخام، احسب تكلفة كل منتج من وصفته، اربط الكاشير بالمخزون، واعرف ربح كل صنف. جرّبه ٣٠ يوماً مجاناً بدون بطاقة.',
  },
  login: {
    title: 'تسجيل الدخول — Bakex',
    description: 'ادخل إلى حساب مخبزك في Bakex.',
    noindex: true,
  },
  register: {
    title: 'ابدأ تجربة مجانية ٣٠ يوماً — Bakex',
    description:
      'أنشئ حساب مخبزك في دقيقة وابدأ ٣٠ يوماً مجاناً بكل المميزات، بدون بطاقة ائتمانية.',
  },
  terms: {
    title: 'الشروط والأحكام — Bakex',
    description: 'شروط استخدام نظام Bakex لإدارة المخابز: الاشتراك، الفترة التجريبية، ملكية البيانات، وحدود المسؤولية.',
  },
  refund: {
    title: 'سياسة الاسترجاع والإلغاء — Bakex',
    description: 'مهلة الاسترجاع، معاملة الجهاز المرفق، ومدة تحويل المبلغ — وماذا يحدث لبياناتك بعد الإلغاء.',
  },
  privacy: {
    title: 'سياسة الخصوصية — Bakex',
    description: 'ما الذي نجمعه ولماذا وأين يُحفَظ، ومن يعالج بياناتك، وحقوقك في الاطلاع والتصحيح والحذف.',
  },
} satisfies Record<string, PageSeo>

export type SeoKey = keyof typeof PAGE_SEO

/** Pages a search engine should see. Everything else is behind a login. */
export const PUBLIC_PATHS = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/register', priority: '0.8', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/refund', priority: '0.3', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
] as const

/**
 * Everything a crawler must not index: the application itself, the API, and
 * anything that only makes sense with a session.
 */
export const PRIVATE_PREFIXES = [
  '/api/', '/dashboard', '/stock', '/recipes', '/produce', '/sales', '/purchases',
  '/reports', '/cost', '/users', '/settings', '/scanner', '/labels', '/cashier',
  '/billing', '/bakeries', '/login', '/verify-email', '/reset-password', '/forgot-password',
] as const

export const canonical = (path: string) => `${appBaseUrl()}${path === '/' ? '' : path}`

/**
 * Structured data describing the product, so a search result can carry the
 * price and the rating slot rather than a bare link. Only facts that are true
 * on the pricing page go in here — an invented rating is a manual penalty.
 */
export function productJsonLd(price: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'ar-SA',
    description: PAGE_SEO.home.description,
    url: appBaseUrl(),
    offers: {
      '@type': 'Offer',
      price: String(price),
      priceCurrency: 'SAR',
      availability: 'https://schema.org/InStock',
      url: `${appBaseUrl()}/#pricing`,
    },
    areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
  }
}
