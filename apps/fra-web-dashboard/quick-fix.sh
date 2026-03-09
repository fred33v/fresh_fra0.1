#!/bin/bash

# Dashboard Quick-Fix Script
# Run this from /apps/fra-web-dashboard directory

echo "🔧 Starting Dashboard Quick-Fix..."
echo ""

# Step 1: Fix Security Vulnerabilities
echo "1️⃣  Fixing security vulnerabilities..."
pnpm audit fix
echo "   ✅ Dependencies audited and fixed"
echo ""

# Step 2: Verify Build
echo "2️⃣  Verifying build..."
pnpm run build
if [ $? -eq 0 ]; then
    echo "   ✅ Build successful"
else
    echo "   ❌ Build failed - check errors above"
    exit 1
fi
echo ""

# Step 3: Show Lint Issues
echo "3️⃣  Showing remaining lint issues..."
pnpm run lint
echo ""
echo "   📝 Manual fix required for:"
echo "      - src/components/ui/command.tsx:24"
echo "      - src/components/ui/textarea.tsx:5"
echo "      - tailwind.config.ts:113"
echo ""

# Step 4: Update Browserslist
echo "4️⃣  Updating browserslist..."
npx update-browserslist-db@latest
echo "   ✅ Browserslist updated"
echo ""

echo "✨ Quick-fix complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Fix ESLint errors (see DASHBOARD_COMPLETION_PLAN.md)"
echo "   2. Fix React Hook warnings in hooks and pages"
echo "   3. Integrate @stopfra/ui-core tokens"
echo "   4. Build the 3 missing features (Assessment, Budget Guide, Employer Dashboard)"
echo "   5. Add unit tests"
echo ""
