#!/bin/bash

# Deploy script for consultor-rag edge function with memory fixes
# This script deploys the updated consultor-rag function that includes:
# - Conversation history loading
# - Context extraction (company name, segment, etc.)
# - Memory persistence across messages

echo "=== Deploying consultor-rag Edge Function ==="
echo ""
echo "This function now includes:"
echo "✓ Conversation history loading (last 10 messages)"
echo "✓ Intelligent context extraction"
echo "✓ Persistent memory across conversation"
echo "✓ Never asks same question twice"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with:"
    echo "   npm install -g supabase"
    exit 1
fi

# Deploy the function
echo "🚀 Deploying consultor-rag function..."
cd "$(dirname "$0")"
supabase functions deploy consultor-rag --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy successful!"
    echo ""
    echo "Next steps:"
    echo "1. Test the chatbot in Consultor mode"
    echo "2. Say your company name once (e.g., 'TRP transportes')"
    echo "3. Verify bot doesn't ask for it again"
    echo "4. Check console for '[CONTEXT-EXTRACT]' logs"
    echo ""
else
    echo ""
    echo "❌ Deploy failed. Check the error above."
    echo ""
    echo "Alternative: Deploy via Supabase Dashboard"
    echo "1. Go to: https://supabase.com/dashboard/project/[your-project]/functions"
    echo "2. Select 'consultor-rag'"
    echo "3. Click 'Deploy new version'"
    echo "4. Upload all files from supabase/functions/consultor-rag/"
    exit 1
fi
