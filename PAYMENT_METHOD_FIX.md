# Payment Method Creation Fix

## Problem
The application was unable to create or register new payment methods because the `upsertPaymentMethod` function was called but never defined.

## Root Cause
In `components/PaymentMethodsModal.tsx`, line 66 called `upsertPaymentMethod(payload)` but this function was not imported or defined anywhere in the codebase.

## Solution
Created a complete payment method service with proper CRUD operations:

### 1. Created Payment Method Service
**File:** `src/services/paymentMethodService.ts`

Features:
- `getAll()` - List all payment methods
- `getActive()` - List only active payment methods
- `getById(id)` - Get a specific payment method
- `upsert(method)` - Create or update a payment method
- `create(method)` - Create a new payment method
- `update(id, updates)` - Update an existing payment method
- `deactivate(id)` - Soft delete (mark as inactive)
- `activate(id)` - Reactivate a payment method
- `delete(id)` - Hard delete a payment method

### 2. Updated Components
- **PaymentMethodsModal.tsx** - Now imports and uses `paymentMethodService.upsert()`
- **NewServiceOrder.tsx** - Now uses `paymentMethodService.getActive()`
- **SalesModalitiesModule.tsx** - Now imports helper functions

### 3. Added Legacy Helper Functions
**File:** `src/utils/legacyHelpers.ts`

Added wrapper functions for backwards compatibility:
- `listPaymentMethods()` - Wraps `paymentMethodService.getAll()`
- `deletePaymentMethod(id)` - Wraps `paymentMethodService.delete()`
- Stubs for `listMachines()`, `upsertMachine()`, `recordAudit()`, `listDeposits()`

## Database Schema Mapping
The service handles the mapping between database schema and application types:

**Database (Supabase):**
```typescript
{
  id: string;
  name: string;
  type: 'cash' | 'card' | 'pix' | 'fiado' | 'boleto' | 'other';
  generates_receivable: boolean;
  is_active: boolean;
  created_at: string;
}
```

**Application (Frontend):**
```typescript
{
  id: string;
  name: string;
  receipt_type: 'cash' | 'card' | 'pix' | 'fiado' | 'boleto' | 'other';
  enters_receivables: boolean;
  default_due_days: number;
  is_active: boolean;
  machine_label?: string;
  created_at?: string | null;
  updated_at?: string | null;
}
```

## Testing
The fix can be tested by:
1. Opening the Sales Modalities Module
2. Clicking "NOVA FORMA PAGTO" button
3. Filling in payment method details
4. Clicking "Salvar" - should now work without errors

## Files Changed
- ✅ `src/services/paymentMethodService.ts` (created)
- ✅ `src/services/index.ts` (added export)
- ✅ `components/PaymentMethodsModal.tsx` (updated import and usage)
- ✅ `components/NewServiceOrder.tsx` (updated to use service)
- ✅ `components/SalesModalitiesModule.tsx` (updated imports)
- ✅ `src/utils/legacyHelpers.ts` (added helper functions)

## Future Improvements
- Implement machine service for card machines management
- Implement audit service for tracking changes
- Remove legacy helpers once all components are refactored to use services directly
- Add proper error handling with toast notifications
