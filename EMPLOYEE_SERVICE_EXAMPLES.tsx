/**
 * 👥 EMPLOYEE SERVICE - GUIA DE USO
 * 
 * Exemplos práticos de como usar o employeeService nos componentes.
 */

import { employeeService } from '@/services';
import { useToast } from '@/hooks/useToast';
import { useState, useEffect } from 'react';

// ==================== EXEMPLO 1: LISTAR COLABORADORES ====================
export function EmployeeListExample() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    async function loadEmployees() {
      try {
        const data = await employeeService.getAll();
        setEmployees(data);
      } catch (error) {
        showError('Erro ao carregar colaboradores', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadEmployees();
  }, []);

  if (loading) return <div>Carregando...</div>;

  return (
    <ul>
      {employees.map(emp => (
        <li key={emp.id}>
          {emp.name} - {emp.role}
        </li>
      ))}
    </ul>
  );
}

// ==================== EXEMPLO 2: CRIAR GERENTE (ACESSO GLOBAL) ====================
export async function createManagerExample() {
  const { showSuccess, showError } = useToast();
  
  try {
    const gerente = await employeeService.create({
      name: 'João Silva',
      role: 'GERENTE',
      deposit_id: null, // ✅ null = acesso a todos os depósitos
      username: 'joao',
      password: 'senha123',
      phone: '11999999999',
      is_active: true
    });
    
    showSuccess('Gerente criado com sucesso!');
    console.log('ID gerado pelo Supabase:', gerente.id);
    // Exemplo: "550e8400-e29b-41d4-a716-446655440000"
    
    return gerente;
  } catch (error) {
    // Error automático extrai detalhes do Supabase
    showError('Erro ao criar gerente', error);
    throw error;
  }
}

// ==================== EXEMPLO 3: CRIAR ATENDENTE (ACESSO LOCAL) ====================
export async function createAttendantExample(depositId: string) {
  const { showSuccess, showError } = useToast();
  
  try {
    const atendente = await employeeService.create({
      name: 'Maria Santos',
      role: 'ATENDENTE',
      deposit_id: depositId, // ✅ Obrigatório para cargos locais!
      username: 'maria',
      password: 'senha456',
      phone: '11988888888',
      is_active: true
    });
    
    showSuccess('Atendente criado com sucesso!');
    return atendente;
  } catch (error) {
    if (error.message.includes('requer depósito')) {
      showError('Atendentes precisam de um depósito vinculado');
    } else {
      showError('Erro ao criar atendente', error);
    }
    throw error;
  }
}

// ==================== EXEMPLO 4: ATUALIZAR COLABORADOR ====================
export async function updateEmployeeExample(employeeId: string) {
  const { showSuccess, showError } = useToast();
  
  try {
    const updated = await employeeService.update(employeeId, {
      phone: '11977777777',
      is_active: true
    });
    
    showSuccess('Colaborador atualizado!');
    return updated;
  } catch (error) {
    showError('Erro ao atualizar colaborador', error);
    throw error;
  }
}

// ==================== EXEMPLO 5: DESATIVAR COLABORADOR ====================
export async function deactivateEmployeeExample(employeeId: string) {
  const { showSuccess, showError, showWarning } = useToast();
  
  try {
    // 1. Verificar se tem histórico
    const hasHistory = await employeeService.hasHistory(employeeId);
    
    if (hasHistory) {
      showWarning(
        'Colaborador possui histórico de vendas/movimentos. ' +
        'Será desativado (não deletado).'
      );
    }
    
    // 2. Desativar (soft delete)
    await employeeService.deactivate(employeeId);
    showSuccess('Colaborador desativado com sucesso!');
  } catch (error) {
    showError('Erro ao desativar colaborador', error);
    throw error;
  }
}

// ==================== EXEMPLO 6: LOGIN (VALIDAR CREDENCIAIS) ====================
export async function loginExample(username: string, password: string) {
  const { showSuccess, showError } = useToast();
  
  try {
    const employee = await employeeService.validateCredentials(username, password);
    
    if (!employee) {
      showError('Usuário ou senha inválidos');
      return null;
    }
    
    showSuccess(`Bem-vindo, ${employee.name}!`);
    return employee;
  } catch (error) {
    showError('Erro ao fazer login', error);
    throw error;
  }
}

// ==================== EXEMPLO 7: BUSCAR POR USERNAME ====================
export async function findByUsernameExample(username: string) {
  const { showError } = useToast();
  
  try {
    const employee = await employeeService.getByUsername(username);
    
    if (!employee) {
      console.log('Usuário não encontrado');
      return null;
    }
    
    console.log('Usuário encontrado:', employee);
    return employee;
  } catch (error) {
    showError('Erro ao buscar usuário', error);
    throw error;
  }
}

// ==================== EXEMPLO 8: LISTAR POR DEPÓSITO ====================
export async function listByDepositExample(depositId: string) {
  const { showError } = useToast();
  
  try {
    const employees = await employeeService.getByDeposit(depositId);
    console.log(`${employees.length} colaboradores no depósito`);
    return employees;
  } catch (error) {
    showError('Erro ao listar colaboradores', error);
    throw error;
  }
}

// ==================== EXEMPLO 9: LISTAR ENTREGADORES ====================
export async function listDriversExample() {
  const { showError } = useToast();
  
  try {
    const drivers = await employeeService.getByRole('ENTREGADOR');
    console.log(`${drivers.length} entregadores disponíveis`);
    return drivers;
  } catch (error) {
    showError('Erro ao listar entregadores', error);
    throw error;
  }
}

// ==================== EXEMPLO 10: COMPONENTE COMPLETO ====================
export function EmployeeFormModal({ depositId, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '',
    role: 'ATENDENTE',
    username: '',
    password: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isGlobalRole = form.role === 'GERENTE' || form.role === 'ENTREGADOR';
      
      const newEmployee = await employeeService.create({
        name: form.name,
        role: form.role,
        deposit_id: isGlobalRole ? null : depositId, // ← Lógica de acesso
        username: form.username,
        password: form.password,
        phone: form.phone,
        is_active: true
      });

      showSuccess(`${form.role} criado com sucesso!`);
      onSuccess(newEmployee);
    } catch (error) {
      if (error.message.includes('já existe')) {
        showError('Nome de usuário já está em uso');
      } else {
        showError('Erro ao criar colaborador', error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder="Nome completo"
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
      />
      
      <select
        value={form.role}
        onChange={e => setForm({ ...form, role: e.target.value })}
      >
        <option value="ATENDENTE">Atendente</option>
        <option value="CAIXA">Caixa</option>
        <option value="ENTREGADOR">Entregador</option>
        <option value="GERENTE">Gerente</option>
      </select>
      
      <input
        placeholder="Nome de usuário"
        value={form.username}
        onChange={e => setForm({ ...form, username: e.target.value })}
      />
      
      <input
        type="password"
        placeholder="Senha"
        value={form.password}
        onChange={e => setForm({ ...form, password: e.target.value })}
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Criando...' : 'Criar Colaborador'}
      </button>
    </form>
  );
}

// ==================== OBSERVAÇÕES IMPORTANTES ====================

/**
 * ⚠️ REGRAS DE ACESSO POR CARGO:
 * 
 * 1. GERENTE e ENTREGADOR:
 *    - deposit_id = null
 *    - Acesso a todos os depósitos
 * 
 * 2. ATENDENTE e CAIXA:
 *    - deposit_id obrigatório
 *    - Acesso apenas ao seu depósito
 * 
 * ❌ Se tentar criar ATENDENTE sem deposit_id:
 * Error: "Cargo ATENDENTE requer depósito vinculado"
 */

/**
 * ⚠️ USERNAME ÚNICO:
 * 
 * O Supabase tem constraint UNIQUE no campo username.
 * Se tentar criar usuário com username duplicado:
 * 
 * Error: "Username 'joao' já existe. Escolha outro."
 * (code: 23505 - PostgreSQL unique violation)
 */

/**
 * ✅ IDs SÃO GERADOS AUTOMATICAMENTE:
 * 
 * NÃO envie campo 'id' no .create()!
 * O Supabase gera UUID automaticamente:
 * 
 * const emp = await employeeService.create({ name: '...' });
 * console.log(emp.id); // "550e8400-e29b-41d4-..."
 */
