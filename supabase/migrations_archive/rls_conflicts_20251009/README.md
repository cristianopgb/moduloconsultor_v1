# Archived RLS Migrations - 2025-10-09

## Why These Were Archived

These 5 migration files were creating conflicting RLS policies that overwrote each other, causing 403 permission errors throughout the application.

## Problem

Multiple migrations were:
1. Creating policies with the same names
2. Not properly removing old policies before creating new ones
3. Running in sequence and overwriting each other
4. Some policies had circular dependencies (querying `public.users` from within RLS checks)

## Files Archived

1. `20251009000001_consolidate_all_rls_policies_final.sql`
2. `20251009030539_fix_user_roles_and_test_users.sql`
3. `20251009043817_fix_users_rls_for_role_checks.sql`
4. `20251009044004_update_rls_policies_to_use_is_master_function.sql`
5. `20251009044738_final_complete_rls_fix_all_tables.sql`

## Replacement

All 5 migrations have been replaced by a single, clean migration:
- `20251009050000_clean_rls_policies_final.sql`

This new migration:
- Removes ALL existing policies first (using dynamic SQL)
- Creates 41 clean policies across 10 tables
- Uses consistent naming convention
- No circular dependencies (uses `is_master()` helper function)
- Properly documented

## DO NOT restore these files

These migrations should never be reapplied. They are kept here only for historical reference.
