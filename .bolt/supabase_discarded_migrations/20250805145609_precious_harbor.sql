/*
  # Criar tabela de templates/modelos

  1. Nova Tabela
    - `models`
      - `id` (uuid, primary key)
      - `name` (text, obrigatório - nome do template)
      - `category` (text, obrigatório - categoria do template)
      - `file_type` (text, obrigatório - tipo de arquivo: docx, xlsx, pptx, html)
      - `file_url` (text, opcional - URL do arquivo template)
      - `description` (text, opcional - descrição do template)
      - `tags` (text[], opcional - array de tags para IA)
      - `preview_image_url` (text, opcional - URL da imagem de preview)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Enable RLS na tabela `models`
    - Política para todos os usuários autenticados lerem templates
    - Política para apenas masters criarem/editarem/deletarem templates

  3. Gatilhos
    - Trigger para atualizar `updated_at` automaticamente

  4. Índices
    - Índices para performance em consultas frequentes
*/

-- Criar tabela models
CREATE TABLE IF NOT EXISTS models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  file_type text NOT NULL CHECK (file_type IN ('docx', 'xlsx', 'pptx', 'html')),
  file_url text,
  description text,
  tags text[],
  preview_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- Política para SELECT - todos os usuários autenticados podem ler templates
CREATE POLICY "All authenticated users can read models"
  ON models
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para INSERT - apenas masters podem criar templates
CREATE POLICY "Only masters can insert models"
  ON models
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'master'
    )
  );

-- Política para UPDATE - apenas masters podem atualizar templates
CREATE POLICY "Only masters can update models"
  ON models
  FOR UPDATE
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

-- Política para DELETE - apenas masters podem deletar templates
CREATE POLICY "Only masters can delete models"
  ON models
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'master'
    )
  );

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_models_updated_at
    BEFORE UPDATE ON models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS models_category_idx ON models(category);
CREATE INDEX IF NOT EXISTS models_file_type_idx ON models(file_type);
CREATE INDEX IF NOT EXISTS models_name_idx ON models(name);
CREATE INDEX IF NOT EXISTS models_created_at_idx ON models(created_at DESC);
CREATE INDEX IF NOT EXISTS models_tags_idx ON models USING GIN(tags);

-- Inserir alguns templates de exemplo
INSERT INTO models (name, category, file_type, description, tags) VALUES
('Contrato de Prestação de Serviços', 'contracts', 'docx', 'Template padrão para contratos de prestação de serviços', ARRAY['contrato', 'serviços', 'legal']),
('Proposta Comercial', 'proposals', 'docx', 'Template para propostas comerciais e orçamentos', ARRAY['proposta', 'comercial', 'orçamento']),
('Relatório Mensal', 'reports', 'xlsx', 'Template para relatórios mensais com gráficos', ARRAY['relatório', 'mensal', 'dados']),
('Apresentação Corporativa', 'presentations', 'pptx', 'Template para apresentações corporativas', ARRAY['apresentação', 'corporativo', 'slides']),
('Documento HTML', 'general', 'html', 'Template básico para documentos HTML', ARRAY['html', 'web', 'documento']),
('Contrato de Trabalho', 'legal', 'docx', 'Template para contratos de trabalho', ARRAY['contrato', 'trabalho', 'rh']),
('Planilha Financeira', 'financial', 'xlsx', 'Template para controle financeiro', ARRAY['financeiro', 'planilha', 'controle']);