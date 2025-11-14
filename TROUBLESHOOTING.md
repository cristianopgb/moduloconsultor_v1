# Troubleshooting - Melhorias Genius UX

## Erro: "Cannot find module '@tailwindcss/typography'"

### Causa
Este erro ocorre quando o dev server está rodando e novas dependências são instaladas. O Vite precisa ser reiniciado para reconhecer os novos pacotes.

### Solução

**Opção 1: Reiniciar o Dev Server**
```bash
# Parar o servidor (Ctrl+C)
# Depois iniciar novamente
npm run dev
```

**Opção 2: Limpar Cache e Reinstalar**
```bash
rm -rf node_modules/.vite
npm install
npm run dev
```

**Opção 3: Build de Produção (sempre funciona)**
```bash
npm run build
```

## Verificação de Instalação

Para verificar se o pacote está corretamente instalado:

```bash
# Verificar se existe
ls -la node_modules/@tailwindcss/typography

# Verificar no package.json
grep "@tailwindcss/typography" package.json
```

Deve retornar:
```
"@tailwindcss/typography": "^0.5.19",
```

## Build de Produção

O build de produção foi testado e funciona perfeitamente:

```
✓ 2005 modules transformed.
✓ built in 14.55s
```

## Notas Importantes

1. **Dev Server vs Build**: Erros no dev server nem sempre significam que o build falhará
2. **Cache do Vite**: Às vezes é necessário limpar `.vite` cache
3. **HMR (Hot Module Replacement)**: Pode não detectar mudanças no `tailwind.config.js` automaticamente

## Dependências Adicionadas

As seguintes dependências foram adicionadas para as melhorias de UX:

```json
{
  "@tailwindcss/typography": "^0.5.19",
  "react-markdown": "^10.1.0",
  "remark-gfm": "^4.0.1",
  "rehype-raw": "^7.0.0",
  "rehype-sanitize": "^6.0.0"
}
```

Todas já estão no `package.json` e instaladas corretamente.

## Teste de Funcionalidades

Para testar se tudo está funcionando:

1. Acesse o chat Genius
2. Envie uma tarefa que gere um arquivo Markdown
3. Clique no arquivo gerado
4. Verifique se:
   - Modal abre corretamente
   - Markdown está renderizado (não como texto puro)
   - Botões de exportação aparecem (Word, PPT)
   - Modo de edição funciona
   - Barra de progresso aparece durante processamento

## Suporte

Se o problema persistir após reiniciar o dev server:

1. Verifique se todas as dependências estão instaladas: `npm install`
2. Limpe completamente: `rm -rf node_modules node_modules/.vite && npm install`
3. Execute o build: `npm run build`
4. Se o build funcionar, o problema é apenas no dev server (reinicie)
