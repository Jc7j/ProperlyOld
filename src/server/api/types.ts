export interface UsersManagementGroup {
  facilityId: string
  settings?: {
    theme?: string
    notifications?: boolean
  }
}

export interface StripeUser {
  customerId?: string
  subscriptionId?: string
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'incomplete'
  plan?: 'free' | 'pro'
}

export interface StripeManagementGroup {
  connectId?: string
  customerId?: string
  subscriptionId?: string
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'incomplete'
  plan?: 'free' | 'pro'
}

export interface PropertyLocationInfo {
  lat: number
  lng: number
  timezone: string
  address: string
  city: string
  state: string
  country: string
  postalCode: string
}

export interface PropertyOwner {
  name: string
  email: string
  phone: string
}

export interface InvoiceFinancialDetails {
  totalAmount?: number
  subTotal?: number
  taxAmount?: number
  managementFeeAmount?: number
}
