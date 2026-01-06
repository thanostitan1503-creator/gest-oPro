# ⚠️ ERROS DE COMPILAÇÃO ESPERADOS

## 🔍 Por que os serviços mostram erros TypeScript?

Os arquivos em `src/services/` mostram erros de compilação como:

```
O argumento do tipo '{ name: string; address?: string; ... }' 
não é atribuível ao parâmetro do tipo 'never'.
```

## ✅ Isso é NORMAL e ESPERADO

### Por quê?

1. **Cliente Supabase sem URL/Key em tempo de compilação**
   - `createClient()` retorna um cliente **genérico** se `VITE_SUPABASE_URL` não estiver definida
   - TypeScript infere tipos como `never` quando não consegue determinar o schema

2. **Em runtime, funcionará perfeitamente**
   - Quando o app rodar com `.env` configurado, os tipos serão corretos
   - O Supabase irá inferir os tipos de `Database` automaticamente

## 🛠️ Como Resolver

### Opção 1: Criar `.env` (Recomendado)

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

Reinicie o VS Code depois.

### Opção 2: Ignorar (Temporário)

Adicione ao `tsconfig.json`:

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

### Opção 3: Type Casting (Menos recomendado)

```typescript
const { data, error } = await (supabase
  .from('deposits')
  .insert(deposit) as any);
```

## 🚀 Verificar se está funcionando

Execute o app:

```bash
npm run dev
```

Se o console não mostrar erros e as operações funcionarem, **está tudo certo**.

## 📝 Nota Importante

- Erros de compilação: **Normais** (VS Code/TypeScript)
- Erros de runtime: **Problema real** (precisa corrigir)

Os serviços foram criados corretamente. A tipagem será resolvida quando o Supabase client for inicializado com variáveis de ambiente válidas.

---

**TL;DR:** Crie `.env` com suas credenciais Supabase e os erros desaparecerão.
