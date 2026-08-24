-- Lets an exercise carry a demo image or short clip. The file itself lives on
-- Cloudinary; we only keep the delivery URL plus the public_id needed to
-- delete or replace it later.
-- Run with: psql "$DATABASE_URL" -f src/migrations/007_exercise_media.sql

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS media_public_id TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS media_type TEXT
  CHECK (media_type IS NULL OR media_type IN ('image', 'video'));
