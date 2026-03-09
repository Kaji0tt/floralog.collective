-- SQL Migration: Add auth_id column to legacy User table
-- Run this in Supabase SQL Editor to link legacy users to Supabase Auth

-- 1. Add auth_id column to User table
ALTER TABLE public."User"
ADD COLUMN auth_id UUID UNIQUE;

-- 2. Add foreign key constraint to auth.users (optional, but recommended)
ALTER TABLE public."User"
ADD CONSTRAINT user_auth_id_fk FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Create index for faster lookups
CREATE INDEX idx_user_auth_id ON public."User"(auth_id);
CREATE INDEX idx_user_email ON public."User"(email);

-- After running this migration, old users can be migrated to Supabase Auth
-- The migration flow will:
-- 1. Send a sign-in email with a confirmation link to their email
-- 2. After the user clicks the link, a Supabase Auth user is created and a session is established
-- 3. Link the legacy user via the auth_id column
