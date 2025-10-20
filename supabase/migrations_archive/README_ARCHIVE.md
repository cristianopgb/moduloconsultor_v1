# Archived Migrations

This directory contains migrations that have been superseded, consolidated, or are no longer needed in the main migration path.

## Archive Structure

### Root Level Files (7 files)
These are older migrations that were replaced by newer consolidated versions:

1. **20251003025805_create_dataset_rows_table.sql**
   - Created `dataset_rows` table for matrix storage
   - **Superseded by**: Analytics V2 system uses different approach
   - **Reason**: Functionality moved to jsonb columns in datasets table

2. **20251003025818_add_queryable_flag_to_datasets.sql**
   - Added `queryable` boolean flag to datasets
   - **Superseded by**: Analytics V2 migration
   - **Reason**: Schema consolidated in later migrations

3. **20251003135332_add_analysis_persistence_columns.sql**
   - Added persistence columns to analyses table
   - **Superseded by**: 20251008000002_analytics_v2_complete.sql
   - **Reason**: Analyses table replaced by data_analyses

4. **20251003135350_insert_analysis_presentation_template.sql**
   - Inserted default presentation template
   - **Status**: Kept for historical reference
   - **Reason**: Shows evolution of template system

5. **20251004094037_fix_models_rls_policies.sql**
   - Fixed RLS policies for models table
   - **Superseded by**: 20251010000000_master_rls_policies_consolidated.sql
   - **Reason**: All RLS consolidated in master migration

6. **20251007151045_fix_dataset_matrix_rls_and_schema.sql**
   - Fixed dataset matrix RLS and schema
   - **Superseded by**: Master RLS migration
   - **Reason**: RLS consolidation

7. **20251009045136_20251009050000_clean_rls_policies_final.sql**
   - Previous attempt at RLS consolidation
   - **Superseded by**: 20251010000000_master_rls_policies_consolidated.sql
   - **Reason**: Replaced by improved master RLS migration with better validation

### Subdirectories

#### conflicting_policies_backup_20251009/ (2 files)
Backup of policies that were causing conflicts:
- `20251008234016_fix_users_rls_policies_for_masters.sql` - User RLS conflicts
- `20251009000000_fix_infinite_recursion_rls_policies.sql` - Circular dependency issues

#### duplicates_and_obsolete_20251008/ (7 files)
Duplicate migrations that were creating the same structures:
- Multiple versions of analytics V2 setup
- Duplicate exec_sql_secure functions
- Overlapping data_analyses table creations

#### rls_conflicts_20251009/ (5 files)
Multiple iterations of RLS fixes that conflicted with each other:
- Various attempts at consolidating RLS policies
- User role and master permission fixes
- All superseded by the master RLS migration

## Current State

**Active Migrations**: 17 files in `/supabase/migrations/`
**Archived Migrations**: 21 files total
  - 7 root level
  - 14 in subdirectories

## Why These Were Archived

The main reasons for archiving:

1. **Duplication**: Multiple migrations doing the same thing
2. **Superseded**: Replaced by consolidated versions
3. **Conflicts**: Creating then dropping the same policies
4. **Iterative Development**: Multiple attempts at fixing the same issue

## DO NOT Restore

These migrations should NOT be restored to the active migrations directory.
They are kept only for:
- Historical reference
- Understanding system evolution
- Debugging if old issues resurface

## Cleanup Performed (2025-10-10)

- Consolidated all RLS policies into single master migration
- Removed duplicate policy creations from knowledge base migration
- Archived conflicting RLS migrations
- Reduced active migrations from 18 to 17
- Improved naming and documentation

## Active Migration Strategy

Going forward:
- **One source of truth for RLS**: 20251010000000_master_rls_policies_consolidated.sql
- **No RLS in feature migrations**: Tables enable RLS, policies are in master migration
- **Clear documentation**: Each migration explains its purpose and dependencies
