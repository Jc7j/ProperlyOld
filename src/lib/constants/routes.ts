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
    SETTINGS: {
      MANAGEMENT_GROUP: '/dashboard/settings/management-group',
      ACCOUNT: '/dashboard/settings/account',
    },
    INVOICE: '/dashboard/properties/:propertyId/invoice/:invoiceId',
  },
} as const

export const ASSET_PATHS = {
  IMAGES: '/images',
  SVG: {
    BRAND: '/svg/brand',
    UI: '/svg/ui',
  },
} as const
