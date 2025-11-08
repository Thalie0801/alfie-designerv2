-- Fix Studio timeout: Add missing indexes on media_generations and job_queue
-- Date: 2025-11-08
-- Error: "canceling statement due to statement timeout" (code 57014)

-- ============================================
-- A. Indexes for media_generations table
-- ============================================

-- Index on user_id for fast user filtering
CREATE INDEX IF NOT EXISTS idx_media_generations_user_id 
ON public.media_generations(user_id);

-- Index on created_at for fast sorting
CREATE INDEX IF NOT EXISTS idx_media_generations_created_at 
ON public.media_generations(created_at DESC);

-- Composite index on user_id + created_at for optimal query performance
CREATE INDEX IF NOT EXISTS idx_media_generations_user_created 
ON public.media_generations(user_id, created_at DESC);

-- Index on order_id for fast order filtering
CREATE INDEX IF NOT EXISTS idx_media_generations_order_id 
ON public.media_generations(order_id) 
WHERE order_id IS NOT NULL;

-- Index on status for fast status filtering
CREATE INDEX IF NOT EXISTS idx_media_generations_status 
ON public.media_generations(status);

-- ============================================
-- B. Indexes for job_queue table
-- ============================================

-- Index on user_id for fast user filtering
CREATE INDEX IF NOT EXISTS idx_job_queue_user_id 
ON public.job_queue(user_id);

-- Index on created_at for fast sorting
CREATE INDEX IF NOT EXISTS idx_job_queue_created_at 
ON public.job_queue(created_at DESC);

-- Composite index on user_id + created_at for optimal query performance
CREATE INDEX IF NOT EXISTS idx_job_queue_user_created 
ON public.job_queue(user_id, created_at DESC);

-- Index on order_id for fast order filtering
CREATE INDEX IF NOT EXISTS idx_job_queue_order_id 
ON public.job_queue(order_id) 
WHERE order_id IS NOT NULL;

-- Index on status for fast status filtering
CREATE INDEX IF NOT EXISTS idx_job_queue_status 
ON public.job_queue(status);

-- Composite index on status + updated_at for stuck jobs detection
CREATE INDEX IF NOT EXISTS idx_job_queue_status_updated 
ON public.job_queue(status, updated_at DESC);

-- ============================================
-- C. Analyze tables for query planner
-- ============================================

-- Update statistics for query optimizer
ANALYZE public.media_generations;
ANALYZE public.job_queue;

-- ============================================
-- D. Verification queries
-- ============================================

-- Verify indexes were created
-- SELECT 
--   schemaname, 
--   tablename, 
--   indexname, 
--   indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('media_generations', 'job_queue')
-- ORDER BY tablename, indexname;

-- Check table sizes
-- SELECT 
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE tablename IN ('media_generations', 'job_queue');
