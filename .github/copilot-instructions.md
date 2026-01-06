# ERP Distribuidora de Gás - Instruções para AI Agents

> **v3.0 Online Real-Time** | React 19 + TypeScript + Vite + Supabase + Tailwind

## Arquitetura Principal

```
React Components → src/services/*.ts → Supabase (PostgreSQL direto)
```

**Regras absolutas:**
- **NUNCA** chame `supabase.from()` em componentes - sempre use services em `src/services/`
- **NUNCA** armazene dados no navegador (zero localStorage/IndexedDB)
- **SEMPRE** trate erros com try/catch + toast visual (`sonner`)

```typescript
// ✅ CORRETO
import { depositService } from '@/services';
const deposits = await depositService.getAll();

// ❌ PROIBIDO
const { data } = await supabase.from('deposits').select('*');
```

## Estrutura de Serviços

| Serviço | Responsabilidade |
|---------|------------------|
| `depositService` | Depósitos/lojas |
| `productService` | Produtos + preços por modalidade |
| `stockService` | Estoque (saldo calculado via SUM) |
| `serviceOrderService` | Vendas atômicas (OS + itens + estoque) |
| `clientService` | Clientes |
| `employeeService` | Colaboradores/usuários |
| `financialService` | Caixa, contas a pagar/receber |
| `deliveryService` | Zonas, setores, entregadores |

## Tipos TypeScript

- **Fonte da verdade:** `src/types/supabase.ts` (40 tabelas tipadas)
- **Supabase usa inglês (snake_case):** `deposit_id`, `is_active`, `sale_price`
- **Frontend usa português (camelCase):** `depositoId`, `ativo`, `precoVenda`
- **NUNCA** use `any` - sempre tipar com `Database['public']['Tables']['nome']['Row']`

## Conceitos de Negócio Críticos

### Tipos de Atendimento (APENAS 2)
```typescript
type TipoAtendimento = 'BALCAO' | 'DELIVERY'; // ÚNICO válido
```

### Tipos de Movimento de Estoque
| Tipo | Descrição | Estoque |
|------|-----------|---------|
| `SIMPLE` | Venda normal | Só SAÍDA |
| `EXCHANGE` | Troca vasilhame | SAÍDA cheio + ENTRADA vazio |
| `FULL` | Venda completa (cliente novo) | Só SAÍDA (sem retorno) |

### Preços por Modalidade (produtos com `movement_type = 'EXCHANGE'`)
- `sale_price` → Preço padrão
- `exchange_price` → Preço na TROCA (cliente devolve casco)
- `full_price` → Preço COMPLETO (cliente leva casco)

## Comandos de Desenvolvimento

```bash
npm run dev          # Iniciar dev server (Vite)
npm run build        # Build para produção
npm run test         # Executar todos os testes
npm run validate     # Validar regras do sistema
```

## Padrão de Componente com Service

```tsx
import { depositService, type Deposit } from '@/services';
import { toast } from 'sonner';

function MyComponent() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await depositService.getAll();
        setDeposits(data);
      } catch (error) {
        toast.error('Erro ao carregar depósitos');
      }
    };
    load();
  }, []);
}
```

## Arquivos-Chave

| Arquivo | Função |
|---------|--------|
| `src/services/index.ts` | Barrel export + cliente Supabase |
| `src/types/supabase.ts` | Tipos das 40 tabelas (Row/Insert/Update) |
| `components/NewServiceOrder.tsx` | PDV principal |
| `components/DepositsStockModule.tsx` | Gestão de estoque |

## Deploy

- **Frontend:** Vercel (auto-deploy via `git push origin main`)
- **Backend:** Supabase (PostgreSQL + Auth)
- **Variáveis:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
