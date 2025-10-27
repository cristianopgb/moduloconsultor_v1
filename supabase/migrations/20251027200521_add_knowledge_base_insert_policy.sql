/*
  # Add INSERT policy for knowledge base

  1. Security
    - Add policy to allow masters to insert documents into knowledge base
    - This enables seeding and management of the knowledge base
    - Regular users can still only read active documents
*/

-- Allow masters to insert knowledge base documents
CREATE POLICY "Masters can insert knowledge documents"
  ON knowledge_base_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Allow masters to update knowledge base documents
CREATE POLICY "Masters can update knowledge documents"
  ON knowledge_base_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Allow masters to delete knowledge base documents
CREATE POLICY "Masters can delete knowledge documents"
  ON knowledge_base_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );
