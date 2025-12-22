# App Restructuring Guide

## Overview
This app has been restructured to follow enterprise-level architecture patterns for better scalability, maintainability, and code organization.

## Directory Structure

```
mobile/
├── app/                          # Expo Router screens (file-based routing)
├── components/                   # React components
│   ├── invoices/                # Invoice-specific components
│   ├── parties/                 # Party-specific components
│   ├── transactions/            # Transaction-specific components
│   ├── accounts/                # Account-specific components
│   ├── common/                  # Shared components across features
│   └── ui/                      # Reusable UI primitives
├── hooks/                       # Custom React hooks
│   ├── use-invoices.ts         # Invoice data fetching & mutations
│   ├── use-parties.ts          # Party data operations
│   └── ...
├── lib/                         # Utilities and helpers
│   ├── validations/            # Zod validation schemas
│   │   ├── invoice.ts
│   │   ├── party.ts
│   │   └── ...
│   ├── api.ts
│   ├── toast.ts
│   └── ...
├── services/                    # API service layer
│   ├── invoices.ts
│   ├── parties.ts
│   └── ...
└── types/                       # TypeScript type definitions
    ├── invoice.ts
    ├── party.ts
    └── ...
```

## Architecture Principles

### 1. Separation of Concerns
Each layer has a specific responsibility:

- **Screens (app/)**: UI layout and user interaction
- **Components**: Reusable UI pieces
- **Hooks**: Data fetching and business logic
- **Validations**: Form validation rules
- **Types**: TypeScript interfaces and types
- **Services**: API communication

### 2. Feature-Based Organization
Components are organized by feature (invoices, parties, transactions, etc.) rather than by type. This makes it easier to:
- Find related code
- Understand feature scope
- Refactor or remove features
- Work on features independently

### 3. Single Responsibility Principle
Each file/component has one clear purpose:
- Components handle rendering
- Hooks handle data operations
- Validations handle form rules
- Types define data structures

## Implementation Pattern (Using Invoices as Example)

### Step 1: Create Types (`types/invoice.ts`)
```typescript
export interface Invoice {
  _id: string;
  invoice_number: string;
  // ... other fields
}

export interface CreateInvoiceParams {
  // ... creation parameters
}

export const STATUS_COLORS = { /* ... */ };
```

**Purpose**: Define all data structures and constants in one place.

### Step 2: Create Validations (`lib/validations/invoice.ts`)
```typescript
import { z } from "zod";

export const invoiceSchema = z.object({
  party_id: z.string().min(1, "Please select a party"),
  date: z.string().min(1, "Invoice date is required"),
  // ... other validation rules
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;
```

**Purpose**: Centralize form validation logic using Zod schemas.

### Step 3: Create Custom Hook (`hooks/use-invoices.ts`)
```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { invoicesApi } from "@/services/invoices";

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => invoicesApi.get(invoiceId),
  });
}

export function useCreateInvoice(options) {
  return useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: () => {
      // Invalidate queries, show toast, etc.
    },
  });
}
```

**Purpose**: Encapsulate all data fetching and mutations in reusable hooks.

### Step 4: Create Feature Components (`components/invoices/`)
```typescript
// invoice-header.tsx
export function InvoiceHeader({ invoice }) {
  return <View>{/* Header UI */}</View>;
}

// invoice-items-table.tsx
export function InvoiceItemsTable({ items }) {
  return <View>{/* Items table UI */}</View>;
}

// index.ts - Centralized exports
export { InvoiceHeader } from "./invoice-header";
export { InvoiceItemsTable } from "./invoice-items-table";
```

**Purpose**: Break down complex screens into smaller, reusable components.

### Step 5: Refactor Screen (`app/(app)/invoices/[invoiceId].tsx`)
```typescript
import { useInvoice, useUpdateInvoiceStatus } from "@/hooks/use-invoices";
import { InvoiceHeader, InvoiceItemsTable } from "@/components/invoices";

export default function InvoiceDetailScreen() {
  const { invoiceId } = useLocalSearchParams();
  const { data: invoice } = useInvoice(invoiceId);
  const statusMutation = useUpdateInvoiceStatus(invoiceId);
  
  return (
    <View>
      <InvoiceHeader invoice={invoice} />
      <InvoiceItemsTable items={invoice.items} />
    </View>
  );
}
```

**Purpose**: Clean, readable screens that compose hooks and components.

## Benefits of This Structure

### 1. **Scalability**
- Easy to add new features following the same pattern
- Components can be reused across different screens
- Clear separation makes codebase easier to navigate as it grows

### 2. **Maintainability**
- Changes to business logic happen in one place (hooks)
- Validation rules centralized in validation files
- Type changes automatically propagate through TypeScript

### 3. **Testability**
- Hooks can be tested independently
- Components can be tested in isolation
- Validation schemas can be unit tested

### 4. **Developer Experience**
- Clear file organization
- Easy to find where logic lives
- Better IDE autocomplete with proper types
- Reduced code duplication

### 5. **Team Collaboration**
- Multiple developers can work on different features without conflicts
- Clear conventions make onboarding easier
- Code reviews are more focused

## Migration Guide for Other Features

To apply this pattern to other features (parties, transactions, accounts):

1. **Create type definitions** in `types/{feature}.ts`
   - Define interfaces for entities
   - Export constants and enums
   - Document complex types

2. **Create validation schemas** in `lib/validations/{feature}.ts`
   - Define Zod schemas for forms
   - Export form data types
   - Include helpful error messages

3. **Create custom hooks** in `hooks/use-{feature}.ts`
   - Implement query hooks (useFeature, useFeatures)
   - Implement mutation hooks (useCreateFeature, useUpdateFeature, etc.)
   - Handle loading states and error handling
   - Invalidate related queries on mutations

4. **Create feature components** in `components/{feature}/`
   - Break down UI into logical components
   - Create an `index.ts` for easy imports
   - Keep components focused on rendering
   - Use TypeScript for prop types

5. **Refactor screens** in `app/(app)/{feature}/`
   - Import and use custom hooks
   - Import and compose components
   - Remove inline logic and validations
   - Focus on user interaction flow

## Best Practices

### Component Design
- Keep components small and focused
- Use TypeScript for all props
- Extract common patterns to shared components
- Document complex component behavior

### Hook Design
- One hook per major entity/feature
- Export multiple focused hooks (not one giant hook)
- Include proper error handling
- Provide loading and error states

### Validation Design
- Use descriptive error messages
- Make optional fields truly optional
- Include field-level and form-level validation
- Export both schemas and TypeScript types

### Type Design
- Define interfaces for API responses
- Define types for component props
- Export constants alongside types
- Use enums for fixed sets of values

## Example File Headers

```typescript
// types/party.ts
/**
 * Party-related type definitions
 * Includes customer and supplier entities
 */

// lib/validations/party.ts
/**
 * Party validation schemas
 * Used in party creation and editing forms
 */

// hooks/use-parties.ts
/**
 * Custom hooks for party data operations
 * Handles CRUD operations and balance calculations
 */

// components/parties/party-card.tsx
/**
 * Party card component
 * Displays party information with balance and quick actions
 */
```

## Common Patterns

### Loading States
```typescript
const { data, isLoading, error } = useFeature(id);

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <NotFound />;

return <FeatureContent data={data} />;
```

### Form Handling
```typescript
const {
  control,
  handleSubmit,
  formState: { errors },
} = useForm<FeatureFormData>({
  resolver: zodResolver(featureSchema),
});

const mutation = useCreateFeature({
  onSuccess: () => router.back(),
});

const onSubmit = (data: FeatureFormData) => {
  mutation.mutate(transformFormData(data));
};
```

### Component Composition
```typescript
return (
  <ScrollView>
    <FeatureHeader feature={data} />
    <FeatureStats feature={data} />
    <FeatureDetails feature={data} />
    <FeatureActions onEdit={handleEdit} onDelete={handleDelete} />
  </ScrollView>
);
```

## Migration Checklist

When refactoring a screen:

- [ ] Create types file
- [ ] Create validation file
- [ ] Create custom hooks file
- [ ] Create component files
- [ ] Create component index.ts
- [ ] Update screen to use new structure
- [ ] Test all functionality
- [ ] Remove old inline code
- [ ] Update imports
- [ ] Check for TypeScript errors

## Resources

- **Zod Documentation**: https://zod.dev
- **React Query**: https://tanstack.com/query/latest
- **React Hook Form**: https://react-hook-form.com
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/

## Next Steps

1. Apply this pattern to **Parties** feature
2. Apply to **Transactions** feature  
3. Apply to **Accounts** feature
4. Create shared UI components in `components/ui/`
5. Create common utilities in `components/common/`
6. Document any feature-specific patterns
