#!/bin/bash
# Quick Deploy Script for Consultor RAG Fixes
# Run this after setting up Supabase credentials

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  CONSULTOR RAG SYSTEM - DEPLOYMENT SCRIPT              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Apply migration
echo "📦 Step 1: Applying database migration..."
echo "   Please apply the migration via Supabase Dashboard SQL Editor:"
echo "   File: supabase/migrations/20251030000000_add_missing_consultor_columns.sql"
echo ""
read -p "Press Enter after applying the migration..."

# Step 2: Deploy Edge Function
echo ""
echo "🚀 Step 2: Deploying consultor-rag Edge Function..."
npx supabase functions deploy consultor-rag --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Edge Function deployed successfully"
else
    echo "❌ Edge Function deployment failed"
    exit 1
fi

# Step 3: Build frontend
echo ""
echo "🔨 Step 3: Building frontend..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Frontend built successfully"
else
    echo "❌ Frontend build failed"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT COMPLETE                                ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Next Steps:                                           ║"
echo "║  1. Deploy dist/ folder to your hosting provider      ║"
echo "║  2. Test first interaction in Consultor mode           ║"
echo "║  3. Verify no schema cache errors in console           ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
