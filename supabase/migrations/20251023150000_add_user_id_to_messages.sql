/*
  # Add user_id column to messages table

  1. Changes
    - Add `user_id` column to `messages` table (nullable for backward compatibility)
    - Add foreign key constraint to `auth.users`
    - Create index on `user_id` for performance
    - Update RLS policies to include user_id checks

  2. Security
    - Column is nullable to maintain compatibility with existing messages
    - RLS policies updated to check user_id where available
*/

-- 1) Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='messages' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN user_id uuid;

    -- Add foreign key constraint
    ALTER TABLE public.messages
      ADD CONSTRAINT fk_messages_user_id
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Create index for performance
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);

-- 3) Update RLS policies to include user_id checks
DROP POLICY IF EXISTS "Users can read own messages" ON messages;
CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
