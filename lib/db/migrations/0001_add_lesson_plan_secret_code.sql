ALTER TABLE lesson_plans
ADD COLUMN IF NOT EXISTS secret_code text;
