# 🌐 ARQUITETURA v3.0 - ONLINE-ONLY (Aplicativo Web na Vercel)

> **Data:** 06/01/2026  
> **Tipo:** Aplicativo Web (como um site, mas interativo)  
> **Hospedagem:** Vercel.com  
> **Dependência:** 100% online (sem funcionar offline)

---

## 🎯 O QUE MUDOU: Offline → Online

### ❌ ANTES (v2.1 - Offline-First):
```
Usuário clica "Salvar"
    ↓
Salva no celular/navegador (Dexie)
    ↓
Adiciona na fila (Outbox)
    ↓
Quando tiver internet → Sincroniza com servidor
```

**Problema:** Se o usuário limpasse o cache do navegador, os dados **sumiam** antes de sincronizar!

---

### ✅ AGORA (v3.0 - Online-Only):
```
Usuário clica "Salvar"
    ↓
Envia DIRETO para o Supabase (servidor)
    ↓
Sucesso: Mostra toast verde ✅
Falha: Mostra toast vermelho ❌ (sem conexão)
```

**Benefício:** **IMPOSSÍVEL** perder dados! Ou está no servidor ou não foi salvo (com feedback claro).

---

## 🏗️ ARQUITETURA FINAL (Como um Site)

```
┌──────────────────────────────────────────────────────┐
│                    USUÁRIO                           │
│        (Gerente, Entregador, Atendente)              │
│        Abre no navegador: seuerp.vercel.app          │
└────────────────────┬─────────────────────────────────┘
                     │ HTTPS
                     │ (Sempre precisa de internet)
                     ▼
┌──────────────────────────────────────────────────────┐
│              VERCEL (Hospedagem Frontend)            │
│                                                      │
│  - React compilado (HTML/CSS/JS)                     │
│  - CDN global (rápido em qualquer lugar do mundo)   │
│  - URL: https://seuerp.vercel.app                   │
│  - SSL/HTTPS automático                              │
│  - Deploy automático (git push = atualização)       │
│                                                      │
└────────────────────┬─────────────────────────────────┘
                     │ API Calls
                     │ (fetch/axios + supabase-js)
                     ▼
┌──────────────────────────────────────────────────────┐
│            SUPABASE (Backend/Servidor)               │
│                                                      │
│  - PostgreSQL (banco de dados)                       │
│  - 40 tabelas (deposits, products, sales, etc)       │
│  - Autenticação (login/senha)                        │
│  - Row Level Security (RLS) - segurança             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🚀 COMO FUNCIONA (Para o Usuário Final)

1. **Gerente/Entregador abre o navegador** (Chrome, Edge, etc.)
2. **Acessa:** `https://seuerp.vercel.app`
3. **Faz login** (Supabase Auth valida)
4. **Usa o sistema:**
   - Criar depósito → Salva DIRETO no Supabase
   - Fazer venda → Salva DIRETO no Supabase
   - Ver estoque → Busca DIRETO do Supabase

5. **Se a internet cair:**
   - ❌ Sistema mostra: "Sem conexão. Verifique sua internet."
   - ❌ NÃO salva nada localmente (evita dados perdidos)

6. **Quando a internet voltar:**
   - ✅ Sistema funciona normalmente de novo

---

## 📱 SERÁ UM PWA? (Progressive Web App)

Sim! O aplicativo funciona como um site, mas pode ser **instalado** no celular/computador:

- **Android/iOS:** "Adicionar à tela inicial" → Abre como app
- **Windows:** "Instalar app" no Chrome → Abre como programa
- **Vantagem:** Usuário não precisa baixar da Play Store

**MAS:** Mesmo instalado, ele **SEMPRE precisa de internet** para funcionar!

---

## 🛠️ DESENVOLVIMENTO

### Stack Tecnológica:
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL na nuvem)
- **Hospedagem Frontend:** Vercel.com (gratuito/pago)
- **Hospedagem Backend:** Supabase.com (gratuito até 500MB)

### Fluxo de Deploy:
```bash
# Desenvolvedor faz alterações
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# Vercel detecta push automático
# 1-2 minutos depois: Site atualizado!
# https://seuerp.vercel.app já está com as mudanças
```

---

## 🔐 SEGURANÇA

### 1. HTTPS Obrigatório
- ✅ Vercel fornece SSL/TLS automático (cadeado verde no navegador)
- ✅ Dados viajam criptografados

### 2. Autenticação
- ✅ Supabase Auth (login/senha)
- ✅ Tokens JWT (usuário não vê)
- ✅ Sessão expira após inatividade

### 3. Autorização (RLS)
- ✅ Atendente só vê seu depósito
- ✅ Gerente vê todos os depósitos
- ✅ Regras no banco de dados (não no frontend)

---

## 📊 COMPARAÇÃO: Offline vs Online

| Aspecto | Offline-First (v2.1) | Online-Only (v3.0) |
|---------|----------------------|--------------------|
| **Funciona sem internet?** | Sim (salva local) | Não (erro imediato) |
| **Risco de perda de dados** | Alto (limpar cache = perder) | Zero (ou salva ou não) |
| **Complexidade** | Extrema (filas, sync) | Mínima (direto no servidor) |
| **Hospedagem** | Difícil | Fácil (Vercel + Supabase) |
| **Manutenção** | Complicada | Simples |
| **Sincronização** | Manual (verificar filas) | Não existe (sempre atualizado) |
| **Feedback de erro** | Silencioso (console) | Imediato (toast visual) |

---

## 🎯 BENEFÍCIOS PARA O NEGÓCIO

### 1. **Confiabilidade 100%**
- Dados **NUNCA** somem
- Sempre sincronizado (não há "fila atrasada")

### 2. **Acesso de Qualquer Lugar**
- Gerente pode ver vendas de casa
- Entregador usa no celular
- Atendente usa no computador da loja

### 3. **Atualizações Instantâneas**
- Venda feita no Depósito A → Aparece no Depósito B na hora
- Gerente vê estoque em tempo real

### 4. **Sem Instalação Complicada**
- Apenas abrir o navegador: `seuerp.vercel.app`
- Funciona em Android, iOS, Windows, Linux, Mac

### 5. **Manutenção Simplificada**
- Developer faz `git push` → Site atualiza em 2 minutos
- Sem precisar "reinstalar app" em cada dispositivo

---

## ⚠️ LIMITAÇÕES (Ser Transparente)

### 1. **Depende 100% da Internet**
- Se Wi-Fi/4G cair → Sistema para
- **Solução:** Internet estável é obrigatória

### 2. **Plano Supabase Gratuito**
- Limite: 500MB de dados + 2GB de transferência/mês
- **Solução:** Monitorar uso, migrar para plano pago se necessário

### 3. **Vercel Gratuito**
- Limite: 100GB de bandwidth/mês
- **Solução:** Geralmente suficiente para pequenas empresas

---

## 📚 DOCUMENTAÇÃO

### Para Desenvolvedores:
1. [Manifesto v3.0](.github/copilot-instructions.md) - Regras do projeto
2. [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md) - Resumo da migração
3. [HOSTING_GUIDE.md](HOSTING_GUIDE.md) - Como fazer deploy na Vercel

### Para Usuários Finais:
- Manual de uso (criar depois do deploy)
- Tutoriais em vídeo (opcional)

---

## 🚀 STATUS ATUAL

**Infraestrutura:** ✅ 100% Pronta  
**Próximo Passo:** Migrar componentes críticos (OpeningShiftModal, NewServiceOrder, etc.)  
**Deploy:** Aguardando finalização dos componentes

---

## 🆘 FAQ

**P: O app funciona offline?**  
R: Não. Se a internet cair, o sistema avisa "Sem conexão" e não salva nada.

**P: Precisa instalar?**  
R: Não. Basta abrir no navegador. Mas pode ser "instalado" como PWA se quiser.

**P: Quanto custa?**  
R: Vercel: Grátis (até 100GB/mês). Supabase: Grátis (até 500MB). Planos pagos disponíveis.

**P: É seguro?**  
R: Sim. HTTPS obrigatório + autenticação + RLS no banco.

**P: Roda em celular?**  
R: Sim. Qualquer navegador moderno (Chrome, Safari, etc.).

---

**Versão:** 3.0 - Online Real-Time  
**Tipo:** Aplicativo Web (SPA - Single Page Application)  
**Hospedagem:** Vercel (frontend) + Supabase (backend)  
**Status:** ✅ Arquitetura definida e implementada
