# Analytics Pipeline Fix - November 19, 2025

## Problem Summary

The analytics system was crashing with:
```
TypeError: Cannot read properties of undefined (reading 'includes')
  at validateSQLQuery (simple-analyzer.ts:161:29)
  at analyzeSmart (smart-analyzer.ts:83:17)
```

## Root Cause

A duplicated file `smart-analyzer.ts` was created that:
1. Imported private functions (`validateSQLQuery`, `callOpenAI`) that weren't exported
2. Called `validateSQLQuery(q.sql)` without the required second parameter `availableColumns`
3. Was redundant because `simple-analyzer.ts` already had the complete intelligent pipeline

## Solution Applied

### 1. Removed Duplicated Code
- ✅ Deleted `supabase/functions/analyze-file/smart-analyzer.ts`
- ✅ Removed import of `analyzeSmart` from `index.ts`
- ✅ Updated `index.ts` to use only `analyzeSimple`

### 2. Added Defensive Validation
Enhanced `validateSQLQuery` in `simple-analyzer.ts` with:
```typescript
if (!sql || typeof sql !== 'string') {
  return { valid: false, error: 'SQL inválido ou vazio' };
}

if (!Array.isArray(availableColumns)) {
  return { valid: false, error: 'availableColumns inválido' };
}
```

### 3. Improved Error Handling
- Added try-catch around `analyzeSimple` in `index.ts`
- Added validation for LLM response formats
- Added logging for invalid query objects
- Enhanced retry logic with format validation

### 4. Made Pipeline More Resilient
- Check if `sqlPlan.queries` is an array before iterating
- Skip invalid query objects instead of crashing
- Log warnings for debugging without breaking the flow
- Return detailed error messages with stack traces

## The Intelligent Pipeline (Already Implemented)

The `simple-analyzer.ts` already contains the complete intelligent pipeline:

1. **Profile Data** - Detect schema, types, and statistics
2. **Reflection** - LLM plans before generating SQL (in `generateSQLPlan`)
3. **SQL Generation** - Creates multiple queries based on user question
4. **Validation** - Checks SQL syntax, columns, and aggregation rules
5. **Retry** - If queries fail, generates corrected versions with error feedback
6. **Execution** - Runs validated queries against the dataset
7. **Narrative Generation** - Creates insights, charts, and recommendations
8. **Anti-Hallucination** - Ensures numbers come only from SQL results

## Testing

Build completed successfully:
```
✓ 2001 modules transformed
✓ built in 15.21s
```

## Next Steps

1. Test with the Excel file that was causing the crash
2. Verify that the intelligent pipeline works end-to-end:
   - Upload Excel → Profile → Reflect → Generate SQL → Validate → Retry if needed → Execute → Narrative
3. Monitor edge function logs for any remaining issues
4. Consider adding more detailed logging at each pipeline stage

## Files Modified

- `supabase/functions/analyze-file/index.ts` - Removed smart-analyzer import, added try-catch
- `supabase/functions/analyze-file/simple-analyzer.ts` - Added defensive validation
- `supabase/functions/analyze-file/smart-analyzer.ts` - DELETED (was duplicate)

## Key Takeaway

The intelligent pipeline was already correctly implemented in `simple-analyzer.ts`. The bug was introduced by creating a broken duplicate that wasn't properly integrated. The fix was to remove the duplicate and strengthen the existing implementation with defensive checks.
