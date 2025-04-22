export const ROUTES = {
  HOME: '/',
  AUTH: {
    SIGNUP: '/sign-up',
    SIGNIN: '/sign-in',
  },
  DASHBOARD: {
    HOME: '/dashboard',
    PROPERTIES: '/dashboard/properties',
    PROPERTY: '/dashboard/properties/:propertyId',
    SUPPLIES: '/dashboard/supplies',
    INVOICE: '/dashboard/properties/:propertyId/invoice/:invoiceId',
    OWNER_STATEMENTS: '/dashboard/owner-statements',
    INVOICES: '/dashboard/invoices',
  },
} as const

export const ASSET_PATHS = {
  IMAGES: '/images',
  SVG: {
    BRAND: '/svg/brand',
    UI: '/svg/ui',
  },
} as const
