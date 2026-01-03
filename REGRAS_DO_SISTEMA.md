# 🏗️ ARQUITETURA E REGRAS DE NEGÓCIO (LEIA ANTES DE CODAR)

## 1. Visão Geral do Sistema
Este é um ERP para Distribuidoras de Gás e Água, focado em operação **Multi-Depósito**.
* **Stack:** React + Vite + TypeScript + TailwindCSS.
* **Banco Local (Offline-First):** Dexie.js (IndexedDB).
* **Banco Remoto (Sync):** Supabase (PostgreSQL).
* **Estratégia de Sync:** As ações são salvas primeiro no Dexie e enviadas via tabela `outbox` para o Supabase.

---

## 2. Entidades e Escopo (Regras de Ouro)

### 👥 Clientes (Clients)
* **GLOBAL:** Clientes são uma entidade da empresa, não de um depósito.
* **Regra:** O campo `deposit_id` deve ser SEMPRE `null`.
* **Visualização:** Um cliente cadastrado na "Filial 1" deve aparecer imediatamente na busca da "Filial 2".
* **Conflitos:** Ao criar, validar duplicidade por Telefone ou CPF.

### 🚚 Entregadores & Colaboradores (Employees)
* **Atendentes/Caixas:** Vinculados a um depósito fixo (`deposit_id` obrigatório).
* **Entregadores (Motoristas):** São **GLOBAIS**.
    * `deposit_id` deve ser `null` ou ignorado nos filtros de busca.
    * **Busca:** Os filtros devem ser *Case Insensitive* (aceitar 'ENTREGADOR', 'Entregador', 'Motorista').
    * Devem aparecer nos dropdowns de O.S. de **todos** os depósitos.

### 🏢 Depósitos (Deposits)
* O sistema opera com múltiplos depósitos (IDs únicos).
* **PROIBIDO:** Nunca usar strings hardcoded como "Depósito Central" ou "Loja". Sempre buscar a lista real de `db.deposits`.

### 📦 Produtos (Products)
* **LOCAL:** Um produto pertence exclusivamente a um depósito (`deposit_id` obrigatório).
* Não existe "Estoque Global" na tabela de produtos. O mesmo item (ex: Gás P13) terá 2 registros no banco se existir em 2 depósitos diferentes.

---

## 3. Ordens de Serviço (O.S.) & Entregas
* **Integridade de Dados:** Ao salvar uma O.S., deve-se gravar os **IDs (UUID)**:
    * `client_id` (Obrigatório)
    * `driver_id` (Obrigatório para entregas)
    * `deposit_id` (Obrigatório - origem do estoque)
* **UX:** Os campos de "Entregador" e "Depósito" no formulário devem ser **Selects Dinâmicos** (menus), nunca campos de texto livre.

## 4. Padrões de Código
* **Reatividade:** Use `useLiveQuery` (do `dexie-react-hooks`) para garantir que as listas atualizem sem precisar de F5.
* **Tipagem:** Mantenha as interfaces TypeScript atualizadas.
* **Prevenção de Erros:** Sempre trate campos opcionais e verifique `null/undefined` antes de acessar propriedades.
