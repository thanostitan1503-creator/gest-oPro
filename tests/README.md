# 🧪 Testes Automatizados - Sistema ERP Gás

## 📋 Visão Geral

Esta pasta contém testes automatizados que validam as **3 correções críticas** implementadas no sistema:

1. **🔐 Sistema de Login** - Migração para repository pattern
2. **⚙️ Sistema EXCHANGE** - Logística reversa de vasilhames
3. **💰 Fechamento de Caixa** - Blind closing com auditoria

---

## 🚀 Como Executar

### Executar todos os testes
```bash
npm run test
```

### Executar teste individual
```bash
# Login
node tests/login.test.ts

# Exchange
node tests/exchange.test.ts

# Fechamento de Caixa
node tests/shift-closing.test.ts
```

---

## 📁 Estrutura dos Testes

```
tests/
├── run-all.ts           # Executor principal (executa todos)
├── login.test.ts        # Testes de autenticação
├── exchange.test.ts     # Testes de logística reversa
├── shift-closing.test.ts # Testes de fechamento de caixa
└── README.md            # Este arquivo
```

---

## ✅ O Que Cada Teste Valida

### 1. Login (7 testes)
- ✅ Criar usuário via `upsertEmployee()`
- ✅ Listar usuários via `listEmployees()`
- ✅ Autenticar usuário (username + password)
- ✅ Editar usuário existente
- ✅ Desativar usuário (soft delete)
- ✅ Validar unicidade de username
- ✅ Criar entregador global (sem depositoId)

### 2. EXCHANGE (7 testes)
- ✅ Criar produto de retorno (vasilhame vazio)
- ✅ Criar produto cheio com `movement_type=EXCHANGE`
- ✅ Adicionar estoque inicial
- ✅ Testar cálculo de movimentos (stock.logic.ts)
- ✅ Criar e concluir OS com produto EXCHANGE
- ✅ Validar movimentos registrados no banco
- ✅ Testar produto SIMPLE (sem retorno)

### 3. Fechamento de Caixa (8 testes)
- ✅ Abrir turno com saldo inicial
- ✅ Registrar vendas (cash, card, pix)
- ✅ Registrar sangria
- ✅ Calcular totais do sistema
- ✅ Fechar turno sem divergência
- ✅ Fechar turno com divergência (blind closing)
- ✅ Validar unicidade de turno aberto
- ✅ Buscar turno aberto do usuário

---

## 🎯 Critérios de Sucesso

Para que o sistema seja considerado **pronto para produção**, todos os testes devem passar:

- ✅ **22/22 testes passando** (100%)
- ✅ Dados persistindo corretamente no Dexie
- ✅ Eventos sendo enfileirados no `outbox_events`
- ✅ Lógica de negócio executando conforme esperado

---

## 🔍 Interpretando os Resultados

### Saída de Sucesso
```
📊 RELATÓRIO CONSOLIDADO DE TESTES
==================================
📈 Estatísticas Gerais:
   • Testes executados: 22
   • Testes aprovados: 22
   • Testes falhados: 0
   • Taxa de sucesso: 100.0%
   • Tempo total: 1.45s

🎉 TODOS OS TESTES PASSARAM COM SUCESSO!
✨ O sistema está pronto para produção.
```

### Saída de Falha
```
❌ ALGUNS TESTES FALHARAM: 20/22
⚠️  Revise os erros acima antes de implantar.
```

---

## 🛠️ Troubleshooting

### "Erro ao conectar ao banco"
**Solução:** Certifique-se de que o Dexie está instalado:
```bash
npm install dexie dexie-react-hooks
```

### "Module not found"
**Solução:** Verifique se os imports estão corretos:
```bash
npm run build
```

### Testes falhando em produção
**Solução:** Limpe o IndexedDB antes de testar:
```javascript
// No console do navegador
indexedDB.deleteDatabase('GestaoProDB');
```

---

## 📝 Adicionando Novos Testes

Para adicionar um novo teste, siga o padrão:

```typescript
// tests/meu-novo-teste.test.ts
import { db } from '../domain/db';

async function testMinhaFuncionalidade() {
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Descrição
  totalTests++;
  try {
    // Seu código de teste aqui
    if (resultado !== esperado) throw new Error('Falhou');
    passedTests++;
  } catch (err) {
    console.error(err);
  }

  return { passed: passedTests, total: totalTests, success: passedTests === totalTests };
}

export { testMinhaFuncionalidade };
```

Depois adicione ao `run-all.ts`:
```typescript
import { testMinhaFuncionalidade } from './meu-novo-teste.test';
// ... adicionar na sequência de execução
```

---

## 🎓 Boas Práticas

1. **Isolar dados de teste:** Sempre limpe o banco antes de cada teste
2. **Usar IDs únicos:** Use `generateId()` para evitar colisões
3. **Testar edge cases:** Valide valores nulos, negativos, duplicados
4. **Documentar expectativas:** Use comentários para explicar o comportamento esperado
5. **Manter independência:** Cada teste deve funcionar isoladamente

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
- Revise os logs detalhados de cada teste
- Verifique o console do navegador (F12) para erros
- Consulte a documentação em `/REGRAS_DO_SISTEMA.md`

---

**Última atualização:** 31/12/2025
**Versão dos testes:** 1.0.0
