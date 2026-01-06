# 🚀 HOSPEDAGEM: Vercel + Supabase (Arquitetura v3.0)

> **Atualizado:** 06/01/2026  
> **Arquitetura:** Online-Only (sem offline-first)

---

## 🏗️ VISÃO GERAL DA ARQUITETURA

```
┌─────────────────────────────────────────────────────────────┐
│                    USUÁRIO FINAL                            │
│         (Entregador, Gerente, Atendente)                    │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  VERCEL (Frontend)                          │
│                                                             │
│  - React build estático (HTML/CSS/JS)                       │
│  - CDN global (baixa latência)                              │
│  - SSL automático                                           │
│  - Deploy automático via Git                                │
│  - URL: https://seuerp.vercel.app                           │
│                                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │ API Calls (supabase-js)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                SUPABASE (Backend)                           │
│                                                             │
│  - PostgreSQL (40 tabelas)                                  │
│  - Autenticação (Supabase Auth)                             │
│  - Row Level Security (RLS)                                 │
│  - Real-time subscriptions                                  │
│  - Storage (se necessário)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 PARTE 1: PREPARAÇÃO DO PROJETO

### 1.1 Verificar Build Local

Antes de hospedar, certifique-se que o projeto compila:

```bash
# Instalar dependências
npm install

# Build de produção
npm run build
```

**Saída esperada:**
```
✓ built in 3.45s
dist/index.html                   1.23 kB
dist/assets/index-abc123.js       245.67 kB
dist/assets/index-xyz789.css      12.34 kB
```

Se houver erros, corrija antes de prosseguir.

### 1.2 Criar `.env.production`

```bash
touch .env.production
```

**Conteúdo:**
```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

> ⚠️ **IMPORTANTE:** Nunca commite `.env.production` no Git! Adicione ao `.gitignore`.

### 1.3 Atualizar `.gitignore`

```bash
# Adicionar ao .gitignore
echo ".env.production" >> .gitignore
echo ".vercel" >> .gitignore
```

---

## 🌐 PARTE 2: DEPLOY NO VERCEL

### Opção A: Deploy via Interface Web (Recomendado)

#### Passo 1: Criar Conta/Login
1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"Sign Up"** ou **"Login"**
3. Conecte com GitHub

#### Passo 2: Importar Projeto
1. Clique em **"New Project"**
2. Selecione seu repositório
3. Se não aparecer, clique em **"Import Git Repository"** e cole a URL

#### Passo 3: Configurar Deploy
Na tela de configuração:

**Framework Preset:**
- Selecione: **Vite**

**Build & Development Settings:**
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

**Environment Variables:**
- Clique em **"Add"** para cada variável:
  - **Name:** `VITE_SUPABASE_URL`  
    **Value:** `https://seu-projeto.supabase.co`
  - **Name:** `VITE_SUPABASE_ANON_KEY`  
    **Value:** `sua-chave-anon`

#### Passo 4: Deploy
1. Clique em **"Deploy"**
2. Aguarde ~2 minutos
3. ✅ Projeto estará em: `https://seu-projeto.vercel.app`

---

### Opção B: Deploy via CLI

#### Passo 1: Instalar Vercel CLI
```bash
npm install -g vercel
```

#### Passo 2: Login
```bash
vercel login
```

Siga as instruções no terminal.

#### Passo 3: Deploy
```bash
# Deploy de teste
vercel

# Deploy de produção
vercel --prod
```

Durante o processo, responda:
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

#### Passo 4: Adicionar Variáveis de Ambiente
```bash
vercel env add VITE_SUPABASE_URL
# Cole o valor: https://seu-projeto.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY
# Cole o valor: sua-chave-anon
```

---

## 🔐 PARTE 3: CONFIGURAR SUPABASE

### 3.1 Adicionar URLs Permitidas

No painel do Supabase:

1. Acesse **Authentication** → **URL Configuration**
2. Em **Site URL**, adicione:
   ```
   https://seu-projeto.vercel.app
   ```
3. Em **Redirect URLs**, adicione:
   ```
   https://seu-projeto.vercel.app/**
   http://localhost:5173/**
   ```

### 3.2 Configurar CORS

No painel do Supabase:

1. Acesse **Settings** → **API**
2. Em **CORS Allowed Origins**, adicione:
   ```
   https://seu-projeto.vercel.app
   http://localhost:5173
   ```

### 3.3 Testar Conexão

Abra o console do navegador em `https://seu-projeto.vercel.app`:

```javascript
// Testar conexão com Supabase
const { data, error } = await supabase.from('deposits').select('count');
console.log(data, error);
```

**Resultado esperado:**
```json
[{ count: 5 }], null
```

Se `error` não for `null`, verifique:
- URLs permitidas no Supabase
- Variáveis de ambiente no Vercel
- CORS configurado

---

## 🔄 PARTE 4: DEPLOY AUTOMÁTICO (CI/CD)

### Como Funciona

Vercel conecta ao seu repositório GitHub. Cada push para `main` dispara um deploy automático.

```
git push origin main
    ↓
GitHub detecta push
    ↓
Vercel inicia build
    ↓
npm install → npm run build
    ↓
Deploy para produção (2-3min)
    ↓
✅ Site atualizado automaticamente
```

### 4.1 Configurar Branch de Produção

No painel do Vercel:

1. Acesse **Settings** → **Git**
2. Em **Production Branch**, defina: `main`
3. Marque **"Auto-Deploy"**

### 4.2 Deploy Preview (Opcional)

Para testar mudanças antes de ir para produção:

```bash
# Criar branch de teste
git checkout -b feature/nova-funcionalidade

# Fazer alterações...
git add .
git commit -m "feat: nova funcionalidade"

# Push para GitHub
git push origin feature/nova-funcionalidade
```

Vercel criará um **preview deploy** em:
```
https://seu-projeto-git-feature-nova-funcionalidade.vercel.app
```

---

## 📊 PARTE 5: MONITORAMENTO

### 5.1 Logs no Vercel

No painel do Vercel:

1. Acesse **Deployments**
2. Clique no deploy mais recente
3. Veja logs de build e runtime

### 5.2 Métricas de Performance

No painel do Vercel:

1. Acesse **Analytics**
2. Veja:
   - Tempo de carregamento
   - Requisições por segundo
   - Erros de runtime

### 5.3 Alertas de Erro (Opcional)

Configure notificações:

1. Acesse **Settings** → **Notifications**
2. Ative **"Deployment Errors"**
3. Adicione seu email

---

## 🐛 TROUBLESHOOTING

### Problema: Build falha com "Module not found"

**Causa:** Dependência faltando  
**Solução:**
```bash
# Verificar package.json
npm install

# Rebuild
npm run build
```

### Problema: Erro "Failed to fetch" no app

**Causa:** Variáveis de ambiente incorretas  
**Solução:**
1. No Vercel, acesse **Settings** → **Environment Variables**
2. Verifique `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Se erradas, corrija e **redeploy**

### Problema: CORS error no console

**Causa:** Supabase não permite domínio Vercel  
**Solução:**
1. No Supabase, acesse **Settings** → **API**
2. Adicione URL Vercel em **CORS Allowed Origins**

### Problema: Autenticação não funciona

**Causa:** Site URL não configurada  
**Solução:**
1. No Supabase, acesse **Authentication** → **URL Configuration**
2. Defina **Site URL** como `https://seu-projeto.vercel.app`

---

## 🎯 CHECKLIST FINAL

### Preparação
- [ ] Build local funciona (`npm run build`)
- [ ] `.env.production` criado (não commitado)
- [ ] `.gitignore` atualizado

### Vercel
- [ ] Projeto conectado ao GitHub
- [ ] Framework Preset: Vite
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy concluído com sucesso
- [ ] Site acessível em `https://seu-projeto.vercel.app`

### Supabase
- [ ] Site URL configurada no Authentication
- [ ] Redirect URLs adicionadas
- [ ] CORS configurado para domínio Vercel
- [ ] Teste de conexão bem-sucedido

### Deploy Automático
- [ ] Branch de produção: `main`
- [ ] Auto-deploy ativado
- [ ] Notificações de erro configuradas (opcional)

---

## 📚 REFERÊNCIAS

- [Documentação Vercel](https://vercel.com/docs)
- [Documentação Supabase](https://supabase.com/docs)
- [Vite Build Guide](https://vitejs.dev/guide/build.html)

---

## 💡 DICAS PRO

### 1. Custom Domain (Domínio Próprio)

No painel do Vercel:
1. Acesse **Settings** → **Domains**
2. Adicione: `erp.suaempresa.com.br`
3. Configure DNS conforme instruções

### 2. Analytics Avançado

Instale Vercel Analytics:
```bash
npm install @vercel/analytics
```

Em `src/main.tsx`:
```typescript
import { inject } from '@vercel/analytics';
inject();
```

### 3. Otimização de Bundle

Em `vite.config.ts`:
```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
});
```

---

**Versão:** 3.0  
**Última atualização:** 06/01/2026  
**Arquitetura:** Online-Only (Vercel + Supabase)
