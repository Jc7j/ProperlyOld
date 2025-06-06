// Shared types for vendor import preview functionality

export interface VendorImportExpense {
  date: string
  description: string
  vendor: string
  amount: number
}

export interface MatchedPropertyPreview {
  property: {
    id: string
    name: string
    address?: string | null
  }
  confidence: number
  reason?: string
  expenses: VendorImportExpense[]
  totalAmount: number
}

export interface UnmatchedPropertyPreview {
  propertyName: string
  expenses: VendorImportExpense[]
  totalAmount: number
}

export interface VendorImportPreview {
  matched: MatchedPropertyPreview[]
  unmatched: UnmatchedPropertyPreview[]
  summary: {
    totalMatchedProperties: number
    totalUnmatchedProperties: number
    totalMatchedExpenses: number
    totalUnmatchedExpenses: number
    totalMatchedAmount: number
    totalUnmatchedAmount: number
  }
}

export interface VendorImportPreviewResponse {
  success: true
  preview: VendorImportPreview
}

// Confirmation types for when user approves the preview
export interface VendorImportConfirmRequest {
  currentStatementId: string
  approvedMatches: MatchedPropertyPreview[] // Only the matches the user approved
}

export interface VendorImportConfirmResponse {
  success: true
  createdCount: number
  updatedPropertiesCount: number
  updatedProperties: string[]
}
