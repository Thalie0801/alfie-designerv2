#!/bin/bash
# Script to replace all Supabase client imports with the wrapper

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  "s|from '@/integrations/supabase/client'|from '@/lib/supabase'|g; \
   s|from \"@/integrations/supabase/client\"|from \"@/lib/supabase\"|g" {} +

echo "✅ All imports updated"
