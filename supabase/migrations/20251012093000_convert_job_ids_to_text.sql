-- Ensure every job_id column is stored as TEXT and no constraint enforces UUID casting
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE pg_get_constraintdef(oid) ILIKE '%job_id%'
      AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I;', constraint_record.table_name, constraint_record.conname);
  END LOOP;
END $$;

DO $$
DECLARE
  column_record RECORD;
BEGIN
  FOR column_record IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name = 'job_id'
      AND data_type = 'uuid'
      AND table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN job_id TYPE text USING job_id::text;', column_record.table_schema, column_record.table_name);
  END LOOP;
END $$;
