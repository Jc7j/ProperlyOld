# Vendor Import Architecture

## Overview

The vendor import system handles both PDF and Excel files, using AI-powered property matching with a preview/confirmation workflow. The system includes caching, bulk operations, and early validation.

## System Architecture

```mermaid
flowchart TB
    subgraph "Import Flow"
        A[User Uploads File] --> B[Early Validation]
        B -->|Valid| C[Cache Check]
        B -->|Invalid| X[Error Response]

        C --> D{Cache Hit?}
        D -->|Hit| E[Use Cached Data]
        D -->|Miss| F[Database Query]

        F --> G[Cache Result]
        G --> E

        E --> H[AI Processing]
        H --> I{GPT Cache Hit?}
        I -->|Hit| J[Use Cached Match]
        I -->|Miss| K[GPT API Call]

        K --> L[Cache GPT Result]
        L --> J

        J --> M[Generate Preview]
        M --> N[User Reviews & Confirms]
        N --> O[Bulk Database Operations]

        O --> P[Parallel Updates]
        P --> Q[Cache Invalidation]
        Q --> R[Success Response]
    end
```

## PDF Import Flow

```mermaid
flowchart TB
    subgraph "PDF Processing"
        A[Upload PDF] --> B[File Validation]
        B --> C[Size & Type Check] --> D{Valid?}
        D -->|No| E[Error Response]
        D -->|Yes| F[Check Duplicates]
    end

    subgraph "Data Retrieval"
        F --> G[Check Redis Cache]
        G --> H{Month Data Cached?}
        H -->|Yes| I[Use Cached Properties]
        H -->|No| J[Query Database]
        J --> K[Cache Results]
        K --> I
    end

    subgraph "AI Processing"
        I --> L[Gemini PDF Extraction]
        L --> M[GPT Property Matching]
        M --> N{GPT Results Cached?}
        N -->|Yes| O[Use Cached Matches]
        N -->|No| P[Call GPT API]
        P --> Q[Cache GPT Results]
        Q --> O
    end

    subgraph "User Confirmation"
        O --> R[Generate Preview]
        R --> S[Show Matched & Unmatched]
        S --> T{User Confirms?}
        T -->|No| U[Edit/Cancel]
        T -->|Yes| V[Bulk Database Operations]
        U --> S
    end

    subgraph "Database Operations"
        V --> W[Chunked Processing]
        W --> X[Parallel Updates]
        X --> Y[Cache Invalidation]
        Y --> Z[Success Response]
    end
```

## Excel Import Flow

```mermaid
flowchart TB
    subgraph "File Processing"
        A[Upload Excel] --> B[Early Validation]
        B --> C{Size/Rows Valid?}
        C -->|No| D[Error Response]
        C -->|Yes| E[Parse Headers]
        E --> F[Validate Data]
    end

    subgraph "Property Matching"
        F --> G[Get Cached Properties]
        G --> H{Cache Hit?}
        H -->|Yes| I[Use Cached Data]
        H -->|No| J[Query Database]
        J --> K[Cache Properties]
        K --> I
    end

    subgraph "GPT Matching"
        I --> L[Extract Property Names]
        L --> M{GPT Cache Hit?}
        M -->|Yes| N[Use Cached Matches]
        M -->|No| O[Call GPT API]
        O --> P[Cache Results]
        P --> N
    end

    subgraph "User Preview & Confirmation"
        N --> Q[Generate Preview]
        Q --> R[Show Results]
        R --> S{Confirm?}
        S -->|No| T[Edit/Cancel]
        S -->|Yes| U[Bulk Operations]
        T --> R
    end

    subgraph "Database Operations"
        U --> V[Chunked Processing]
        V --> W[Parallel Updates]
        W --> X[Invalidate Cache]
        X --> Y[Success Response]
    end
```

## Caching Architecture

```mermaid
flowchart LR
    subgraph "Redis Cache Layers"
        C1[Month Statements<br/>TTL: 5 min]
        C2[Property Mappings<br/>TTL: 10 min]
        C3[GPT Results<br/>TTL: 1 hour]
        C4[Expense Checks<br/>TTL: 5 min]
        C5[Session Data<br/>TTL: 15 min]
    end

    subgraph "Cache Strategy"
        S1[Try Cache First]
        S2[Fallback to DB]
        S3[Cache Result]
        S4[Smart Invalidation]
    end

    S1 --> S2 --> S3 --> S4
```

## Code Organization

### Client Components

```typescript
// MonthlyVendorImporter.tsx - PDF Upload & Processing
- File validation (size, type)
- 4-step progress indicator
- Preview with matched/unmatched properties
- Confirmation workflow with edit capabilities

// VendorExcelImporter.tsx - Excel Upload & Processing
- Excel parsing with validation
- Property matching preview
- Bulk confirmation workflow
- Error handling with feedback
```

### Server-Side Logic

```typescript
// ownerStatement.ts - Core Business Logic
- getCachedMonthProperties() - Property fetching with caching
- getCachedGPTMatching() - AI result caching
- Bulk database operations with chunking
- Cache invalidation on data changes

// process/route.ts - PDF Processing
- Gemini AI integration with caching
- Duplicate checking
- GPT matching with cache layer
- Preview data generation

// confirm/route.ts - Final Confirmation
- Bulk expense creation (300 per chunk)
- Parallel statement updates
- Transaction handling
- Cache invalidation
```

### Utility Services

```typescript
// vendor-cache.ts - Caching Layer
- Multi-level Redis caching
- TTL management
- Cache invalidation
- Hash-based cache keys

// kv.ts - Redis Interface
- Environment-based prefixes
- Type-safe operations
- Serialization
```

## Database Operations

- **Bulk Operations**: `createMany()` with `skipDuplicates: true`
- **Chunked Processing**: 300 expenses per transaction
- **Parallel Processing**: `Promise.all()` for concurrent operations
- **Early Validation**: Pre-transaction data validation
- **Smart Queries**: Select only required fields

## Validation Pipeline

- **File Size**: 10MB limit
- **File Type**: PDF/Excel validation before processing
- **Row Limits**: 1000 expense limit for Excel files
- **Header Validation**: Required columns check
- **Duplicate Detection**: Existing expense checking

## User Experience Features

### Progress Indicators

- 4-step visual progress (Upload → Processing → Preview → Confirm)
- Real-time status messages
- Processing time estimates
- Cancellation support

### Preview & Confirmation

- **Matched Properties**: Show confidence scores and reasoning
- **Unmatched Properties**: Clear identification of unprocessed items
- **Edit Capabilities**: Modify mappings before confirmation
- **Summary Statistics**: Totals and counts for review

### Error Handling

- **Early Validation**: Immediate feedback on file issues
- **Graceful Degradation**: Fallback strategies for API failures
- **Detailed Errors**: Specific messages with actionable guidance
- **Recovery Options**: Retry and edit capabilities

## GPT Matching Capabilities

The system can intelligently match:

- **Name to Name**: "Sunset Villa" → "Sunset Villa Apartments"
- **Address to Address**: "123 Main St" → "123 Main Street, Apt 1"
- **Name to Address**: "Ocean View" → "456 Ocean View Drive"
- **Address to Name**: "789 Pine Street" → "Pine Street Condo"
- **Partial Matches**: "Main St Unit 2" → "123 Main Street Apartment 2"
- **Normalization**: Handles abbreviations, spacing, punctuation automatically

## Security Considerations

- **File Validation**: Strict file type and size checking
- **Data Sanitization**: Clean all user inputs
- **Access Control**: Organization-level data isolation
- **Cache Security**: Prefixed keys prevent data leakage
- **Transaction Safety**: Atomic operations with rollback support
