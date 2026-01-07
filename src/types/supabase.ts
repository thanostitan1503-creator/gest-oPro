/**
 * 🔥 TYPES GERADOS DO SUPABASE (40 TABELAS)
 * 
 * Baseado no manifesto: .github/copilot-instructions.md
 * Atualizado em: 06/01/2026
 * 
 * IMPORTANTE: Estes tipos são a FONTE DA VERDADE para comunicação com Supabase.
 * Campos estão em INGLÊS (snake_case) conforme schema do banco.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // ==================== CORE (8 TABELAS) ====================
      
      /**
       * 1. DEPOSITS - Depósitos/Lojas
       */
      deposits: {
        Row: {
          id: string
          name: string
          address: string | null
          active: boolean
          color: string | null
          require_stock_audit: boolean
          free_shipping_min_value: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          active?: boolean
          color?: string | null
          require_stock_audit?: boolean
          free_shipping_min_value?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          active?: boolean
          color?: string | null
          require_stock_audit?: boolean
          free_shipping_min_value?: number | null
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 2. PRODUCTS - Produtos (gás, água, vasilhames)
       */
      products: {
        Row: {
          id: string
          code: string | null
          name: string
          description: string | null
          type: 'GAS_CHEIO' | 'VASILHAME_VAZIO' | 'AGUA' | 'OUTROS'
          unit: string
          sale_price: number
          cost_price: number
          exchange_price: number | null
          full_price: number | null
          movement_type: 'SIMPLE' | 'EXCHANGE' | 'FULL'
          return_product_id: string | null
          track_stock: boolean
          is_active: boolean
          deposit_id: string | null
          product_group: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code?: string | null
          name: string
          description?: string | null
          type?: 'GAS_CHEIO' | 'VASILHAME_VAZIO' | 'AGUA' | 'OUTROS'
          unit?: string
          sale_price?: number
          cost_price?: number
          exchange_price?: number | null
          full_price?: number | null
          movement_type?: 'SIMPLE' | 'EXCHANGE' | 'FULL'
          return_product_id?: string | null
          track_stock?: boolean
          is_active?: boolean
          deposit_id?: string | null
          product_group?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string | null
          name?: string
          description?: string | null
          type?: 'GAS_CHEIO' | 'VASILHAME_VAZIO' | 'AGUA' | 'OUTROS'
          unit?: string
          sale_price?: number
          cost_price?: number
          exchange_price?: number | null
          full_price?: number | null
          movement_type?: 'SIMPLE' | 'EXCHANGE' | 'FULL'
          return_product_id?: string | null
          track_stock?: boolean
          is_active?: boolean
          deposit_id?: string | null
          product_group?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 3. EMPLOYEES - Colaboradores
       */
      employees: {
        Row: {
          id: string
          name: string
          role: 'GERENTE' | 'ENTREGADOR' | 'ATENDENTE' | 'CAIXA'
          deposit_id: string | null
          active: boolean
          username: string
          password: string
          permissions: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          role: 'GERENTE' | 'ENTREGADOR' | 'ATENDENTE' | 'CAIXA'
          deposit_id?: string | null
          active?: boolean
          username: string
          password: string
          permissions?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: 'GERENTE' | 'ENTREGADOR' | 'ATENDENTE' | 'CAIXA'
          deposit_id?: string | null
          active?: boolean
          username?: string
          password?: string
          permissions?: string[]
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 4. CLIENTS - Clientes
       */
      clients: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          cpf: string | null
          reference: string | null
          sector_id: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          phone?: string | null
          cpf?: string | null
          reference?: string | null
          sector_id?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          phone?: string | null
          cpf?: string | null
          reference?: string | null
          sector_id?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 5. PAYMENT_METHODS - Formas de Pagamento
       */
      payment_methods: {
        Row: {
          id: string
          name: string
          receipt_type: 'cash' | 'card' | 'pix' | 'fiado' | 'boleto' | 'other'
          generates_receivable: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          receipt_type: 'cash' | 'card' | 'pix' | 'fiado' | 'boleto' | 'other'
          generates_receivable?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          receipt_type?: 'cash' | 'card' | 'pix' | 'fiado' | 'boleto' | 'other'
          generates_receivable?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 5a. PAYMENT_METHOD_DEPOSIT_CONFIG - Config por deposito
       */
      payment_method_deposit_config: {
        Row: {
          payment_method_id: string
          deposit_id: string
          is_active: boolean
          due_days: number
          max_installments: number
          created_at: string
          updated_at: string
        }
        Insert: {
          payment_method_id: string
          deposit_id: string
          is_active?: boolean
          due_days?: number
          max_installments?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          payment_method_id?: string
          deposit_id?: string
          is_active?: boolean
          due_days?: number
          max_installments?: number
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 6. SERVICE_ORDERS - Ordens de Serviço (Vendas)
       */
      service_orders: {
        Row: {
          id: string
          order_number: string
          deposit_id: string
          client_id: string | null
          client_name: string
          client_phone: string | null
          delivery_address: string | null
          service_type: 'BALCAO' | 'DELIVERY'
          status: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA'
          delivery_status: 'CRIADA' | 'PENDENTE_ENTREGA' | 'EM_ROTA' | 'CONCLUIDA' | 'DEVOLVIDA' | 'CANCELADA' | null
          total: number
          delivery_fee: number
          driver_id: string | null
          zone_id: string | null
          sector_id: string | null
          created_at: string
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          deposit_id: string
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          delivery_address?: string | null
          service_type: 'BALCAO' | 'DELIVERY'
          status?: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA'
          delivery_status?: 'CRIADA' | 'PENDENTE_ENTREGA' | 'EM_ROTA' | 'CONCLUIDA' | 'DEVOLVIDA' | 'CANCELADA' | null
          total: number
          delivery_fee?: number
          driver_id?: string | null
          zone_id?: string | null
          sector_id?: string | null
          created_at?: string
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          deposit_id?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          delivery_address?: string | null
          service_type?: 'BALCAO' | 'DELIVERY'
          status?: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA'
          delivery_status?: 'CRIADA' | 'PENDENTE_ENTREGA' | 'EM_ROTA' | 'CONCLUIDA' | 'DEVOLVIDA' | 'CANCELADA' | null
          total?: number
          delivery_fee?: number
          driver_id?: string | null
          zone_id?: string | null
          sector_id?: string | null
          created_at?: string
          completed_at?: string | null
          updated_at?: string
        }
      }

      /**
       * 7. SERVICE_ORDER_ITEMS - Itens da OS
       */
      service_order_items: {
        Row: {
          id: string
          service_order_id: string
          product_id: string
          quantity: number
          unit_price: number
          modality: string
          sale_movement_type: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null
          created_at: string
        }
        Insert: {
          id?: string
          service_order_id: string
          product_id: string
          quantity: number
          unit_price: number
          modality?: string
          sale_movement_type?: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null
          created_at?: string
        }
        Update: {
          id?: string
          service_order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          modality?: string
          sale_movement_type?: 'SIMPLE' | 'EXCHANGE' | 'FULL' | null
          created_at?: string
        }
      }

      /**
       * 8. SERVICE_ORDER_PAYMENTS - Pagamentos da OS
       */
      service_order_payments: {
        Row: {
          id: string
          service_order_id: string
          payment_method_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          service_order_id: string
          payment_method_id: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          service_order_id?: string
          payment_method_id?: string
          amount?: number
          created_at?: string
        }
      }

      // ==================== ESTOQUE (6 TABELAS) ====================

      /**
       * 9. STOCK_BALANCE - Saldo de Estoque (cache)
       */
      stock_balance: {
        Row: {
          id: string
          product_id: string
          deposit_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          deposit_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          deposit_id?: string
          quantity?: number
          updated_at?: string
        }
      }

      /**
       * 10. STOCK_MOVEMENTS - Movimentações de Estoque
       */
      stock_movements: {
        Row: {
          id: string
          product_id: string
          deposit_id: string
          quantity: number
          type: 'IN' | 'OUT'
          origin: 'SALE' | 'PURCHASE' | 'TRADE_IN' | 'LOSS' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'CARGA_INICIAL'
          reason: string | null
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          deposit_id: string
          quantity: number
          type: 'IN' | 'OUT'
          origin: 'SALE' | 'PURCHASE' | 'TRADE_IN' | 'LOSS' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'CARGA_INICIAL'
          reason?: string | null
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          deposit_id?: string
          quantity?: number
          type?: 'IN' | 'OUT'
          origin?: 'SALE' | 'PURCHASE' | 'TRADE_IN' | 'LOSS' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'CARGA_INICIAL'
          reason?: string | null
          reference_id?: string | null
          created_at?: string
        }
      }

      /**
       * 11. STOCK_TRANSFERS - Transferências entre Depósitos
       */
      stock_transfers: {
        Row: {
          id: string
          from_deposit_id: string
          to_deposit_id: string
          status: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA'
          notes: string | null
          created_by: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          from_deposit_id: string
          to_deposit_id: string
          status?: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA'
          notes?: string | null
          created_by: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          from_deposit_id?: string
          to_deposit_id?: string
          status?: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA'
          notes?: string | null
          created_by?: string
          created_at?: string
          completed_at?: string | null
        }
      }

      /**
       * 12. STOCK_TRANSFER_ITEMS - Itens de Transferência
       */
      stock_transfer_items: {
        Row: {
          id: string
          transfer_id: string
          product_id: string
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          transfer_id: string
          product_id: string
          quantity: number
          created_at?: string
        }
        Update: {
          id?: string
          transfer_id?: string
          product_id?: string
          quantity?: number
          created_at?: string
        }
      }

      /**
       * 13. STOCK_COUNTS - Contagens de Estoque
       */
      stock_counts: {
        Row: {
          id: string
          deposit_id: string
          status: 'ABERTA' | 'CONCLUIDA' | 'CANCELADA'
          notes: string | null
          created_by: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          deposit_id: string
          status?: 'ABERTA' | 'CONCLUIDA' | 'CANCELADA'
          notes?: string | null
          created_by: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          deposit_id?: string
          status?: 'ABERTA' | 'CONCLUIDA' | 'CANCELADA'
          notes?: string | null
          created_by?: string
          created_at?: string
          completed_at?: string | null
        }
      }

      /**
       * 14. STOCK_COUNT_ITEMS - Itens da Contagem
       */
      stock_count_items: {
        Row: {
          id: string
          count_id: string
          product_id: string
          system_quantity: number
          counted_quantity: number
          difference: number
          created_at: string
        }
        Insert: {
          id?: string
          count_id: string
          product_id: string
          system_quantity: number
          counted_quantity: number
          difference: number
          created_at?: string
        }
        Update: {
          id?: string
          count_id?: string
          product_id?: string
          system_quantity?: number
          counted_quantity?: number
          difference?: number
          created_at?: string
        }
      }

      // ==================== FINANCEIRO (6 TABELAS) ====================

      /**
       * 15. ACCOUNTS_RECEIVABLE - Contas a Receber
       */
      accounts_receivable: {
        Row: {
          id: string
          order_id: string | null
          deposit_id: string | null
          client_id: string | null
          client_name: string | null
          original_amount: number
          paid_amount: number | null
          remaining_amount: number | null
          status: string | null
          due_date: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          deposit_id?: string | null
          client_id?: string | null
          client_name?: string | null
          original_amount: number
          paid_amount?: number | null
          remaining_amount?: number | null
          status?: string | null
          due_date?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string | null
          deposit_id?: string | null
          client_id?: string | null
          client_name?: string | null
          original_amount?: number
          paid_amount?: number | null
          remaining_amount?: number | null
          status?: string | null
          due_date?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }

      /**
       * 16. RECEIVABLE_PAYMENTS - Pagamentos de Recebíveis
       */
      receivable_payments: {
        Row: {
          id: string
          receivable_id: string
          amount: number
          payment_method: string | null
          user_id: string | null
          paid_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          receivable_id: string
          amount: number
          payment_method?: string | null
          user_id?: string | null
          paid_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          receivable_id?: string
          amount?: number
          payment_method?: string | null
          user_id?: string | null
          paid_at?: string | null
          created_at?: string | null
        }
      }

      /**
       * 17. EXPENSES - Despesas/Contas a Pagar
       */
      expenses: {
        Row: {
          id: string
          description: string
          amount: number
          due_date: string
          paid_date: string | null
          status: 'PENDENTE' | 'PAGO' | 'ATRASADO'
          category: 'FIXA' | 'VARIAVEL' | 'SALARIO'
          deposit_id: string | null
          alert_days_before: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          description: string
          amount: number
          due_date: string
          paid_date?: string | null
          status?: 'PENDENTE' | 'PAGO' | 'ATRASADO'
          category: 'FIXA' | 'VARIAVEL' | 'SALARIO'
          deposit_id?: string | null
          alert_days_before?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          description?: string
          amount?: number
          due_date?: string
          paid_date?: string | null
          status?: 'PENDENTE' | 'PAGO' | 'ATRASADO'
          category?: 'FIXA' | 'VARIAVEL' | 'SALARIO'
          deposit_id?: string | null
          alert_days_before?: number
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 18. WORK_SHIFTS - Turnos de Trabalho/Caixa
       */
      work_shifts: {
        Row: {
          id: string
          deposit_id: string
          user_id: string
          status: 'OPEN' | 'CLOSED' | 'DISCREPANCY'
          opened_at: string
          closed_at: string | null
          opening_balance: number
          closing_balance: number | null
          declared_cash: number | null
          declared_card: number | null
          declared_pix: number | null
          system_cash: number | null
          system_card: number | null
          system_pix: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          deposit_id: string
          user_id: string
          status?: 'OPEN' | 'CLOSED' | 'DISCREPANCY'
          opened_at: string
          closed_at?: string | null
          opening_balance: number
          closing_balance?: number | null
          declared_cash?: number | null
          declared_card?: number | null
          declared_pix?: number | null
          system_cash?: number | null
          system_card?: number | null
          system_pix?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          deposit_id?: string
          user_id?: string
          status?: 'OPEN' | 'CLOSED' | 'DISCREPANCY'
          opened_at?: string
          closed_at?: string | null
          opening_balance?: number
          closing_balance?: number | null
          declared_cash?: number | null
          declared_card?: number | null
          declared_pix?: number | null
          system_cash?: number | null
          system_card?: number | null
          system_pix?: number | null
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 19. CASH_FLOW_ENTRIES - Lançamentos de Caixa
       */
      cash_flow_entries: {
        Row: {
          id: string
          deposit_id: string
          shift_id: string | null
          type: 'ENTRADA' | 'SAIDA'
          amount: number
          description: string
          reference_id: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          deposit_id: string
          shift_id?: string | null
          type: 'ENTRADA' | 'SAIDA'
          amount: number
          description: string
          reference_id?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          deposit_id?: string
          shift_id?: string | null
          type?: 'ENTRADA' | 'SAIDA'
          amount?: number
          description?: string
          reference_id?: string | null
          created_by?: string
          created_at?: string
        }
      }

      /**
       * 20. SHIFT_STOCK_AUDITS - Auditoria de Estoque/Turno
       */
      shift_stock_audits: {
        Row: {
          id: string
          shift_id: string
          product_id: string
          opening_quantity: number
          closing_quantity: number
          difference: number
          created_at: string
        }
        Insert: {
          id?: string
          shift_id: string
          product_id: string
          opening_quantity: number
          closing_quantity: number
          difference: number
          created_at?: string
        }
        Update: {
          id?: string
          shift_id?: string
          product_id?: string
          opening_quantity?: number
          closing_quantity?: number
          difference?: number
          created_at?: string
        }
      }

      // ==================== DELIVERY (5 TABELAS) ====================

      /**
       * 21. DELIVERY_ZONES - Zonas de Entrega (globais)
       */
      delivery_zones: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 22. DELIVERY_SECTORS - Setores/Bairros das Zonas
       */
      delivery_sectors: {
        Row: {
          id: string
          zone_id: string
          name: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          zone_id: string
          name: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          zone_id?: string
          name?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 23. ZONE_PRICING - Taxa de Entrega por Zona/Depósito
       */
      zone_pricing: {
        Row: {
          id: string
          zone_id: string
          deposit_id: string
          delivery_fee: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          zone_id: string
          deposit_id: string
          delivery_fee: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          zone_id?: string
          deposit_id?: string
          delivery_fee?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 28. DELIVERY_JOBS - Jobs de Entrega
       */
      delivery_jobs: {
        Row: {
          id: string
          service_order_id: string
          driver_id: string | null
          status: 'CRIADA' | 'PENDENTE_ENTREGA' | 'EM_ROTA' | 'CONCLUIDA' | 'DEVOLVIDA' | 'CANCELADA'
          created_at: string
          started_at: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          service_order_id: string
          driver_id?: string | null
          status?: 'CRIADA' | 'PENDENTE_ENTREGA' | 'EM_ROTA' | 'CONCLUIDA' | 'DEVOLVIDA' | 'CANCELADA'
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          service_order_id?: string
          driver_id?: string | null
          status?: 'CRIADA' | 'PENDENTE_ENTREGA' | 'EM_ROTA' | 'CONCLUIDA' | 'DEVOLVIDA' | 'CANCELADA'
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
      }

      /**
       * 29. DRIVER_PRESENCE - Presença de Entregadores
       */
      driver_presence: {
        Row: {
          id: string
          driver_id: string
          deposit_id: string
          status: 'OFFLINE' | 'DISPONIVEL' | 'PAUSADO' | 'OCUPADO'
          latitude: number | null
          longitude: number | null
          last_seen: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          deposit_id: string
          status?: 'OFFLINE' | 'DISPONIVEL' | 'PAUSADO' | 'OCUPADO'
          latitude?: number | null
          longitude?: number | null
          last_seen: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          deposit_id?: string
          status?: 'OFFLINE' | 'DISPONIVEL' | 'PAUSADO' | 'OCUPADO'
          latitude?: number | null
          longitude?: number | null
          last_seen?: string
          created_at?: string
          updated_at?: string
        }
      }

      // ==================== PRECIFICAÇÃO (4 TABELAS) ====================

      /**
       * 24. PRODUCT_PRICING - Preço do Produto por Depósito
       */
      product_pricing: {
        Row: {
          id: string
          product_id: string
          deposit_id: string
          sale_price: number
          exchange_price: number | null
          full_price: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          deposit_id: string
          sale_price: number
          exchange_price?: number | null
          full_price?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          deposit_id?: string
          sale_price?: number
          exchange_price?: number | null
          full_price?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 25. PRODUCT_EXCHANGE_RULES - Regras de Troca (Cheio↔Vazio)
       */
      product_exchange_rules: {
        Row: {
          id: string
          full_product_id: string
          empty_product_id: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          full_product_id: string
          empty_product_id: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          full_product_id?: string
          empty_product_id?: string
          is_active?: boolean
          created_at?: string
        }
      }

      /**
       * 26. CLIENT_PRICE_OVERRIDES - Preços Especiais por Cliente
       */
      client_price_overrides: {
        Row: {
          id: string
          client_id: string
          product_id: string
          special_price: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          product_id: string
          special_price: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          product_id?: string
          special_price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 27. CLIENT_ONE_TIME_BENEFITS - Descontos Únicos
       */
      client_one_time_benefits: {
        Row: {
          id: string
          client_id: string
          product_id: string
          discount_amount: number
          used: boolean
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          product_id: string
          discount_amount: number
          used?: boolean
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          product_id?: string
          discount_amount?: number
          used?: boolean
          used_at?: string | null
          created_at?: string
        }
      }

      // ==================== AUXILIARES (10 TABELAS) ====================

      /**
       * 30. MACHINES - Maquininhas de Cartão
       */
      machines: {
        Row: {
          id: string
          name: string
          deposit_id: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          deposit_id: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          deposit_id?: string
          is_active?: boolean
          created_at?: string
        }
      }

      /**
       * 36. AUDIT_LOGS - Logs de Auditoria
       */
      audit_logs: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          action: 'CREATE' | 'UPDATE' | 'DELETE'
          user_id: string
          changes: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          action: 'CREATE' | 'UPDATE' | 'DELETE'
          user_id: string
          changes?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          action?: 'CREATE' | 'UPDATE' | 'DELETE'
          user_id?: string
          changes?: Json | null
          created_at?: string
        }
      }

      /**
       * 37. FINANCIAL_SETTINGS - Configurações Financeiras
       */
      financial_settings: {
        Row: {
          id: string
          key: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 38. OUTBOX_EVENTS - Fila de Sincronização (Offline-First)
       */
      outbox_events: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          operation: 'INSERT' | 'UPDATE' | 'DELETE'
          payload: Json
          status: 'PENDING' | 'SENT' | 'FAILED'
          attempts: number
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          operation: 'INSERT' | 'UPDATE' | 'DELETE'
          payload: Json
          status?: 'PENDING' | 'SENT' | 'FAILED'
          attempts?: number
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          operation?: 'INSERT' | 'UPDATE' | 'DELETE'
          payload?: Json
          status?: 'PENDING' | 'SENT' | 'FAILED'
          attempts?: number
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      /**
       * 39. BOLETOS - Boletos Bancários
       */
      boletos: {
        Row: {
          id: string
          receivable_id: string | null
          barcode: string
          amount: number
          due_date: string
          paid: boolean
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          receivable_id?: string | null
          barcode: string
          amount: number
          due_date: string
          paid?: boolean
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          receivable_id?: string | null
          barcode?: string
          amount?: number
          due_date?: string
          paid?: boolean
          paid_at?: string | null
          created_at?: string
        }
      }

      /**
       * 40. KV - Key-Value Store (configurações gerais)
       */
      kv: {
        Row: {
          key: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
      }

      // ==================== LEGADO (5 TABELAS) ====================
      // Mantidas para compatibilidade - Preferir usar as novas

      /**
       * 31. PRICE_TABLE (LEGADO) - Usar product_pricing
       */
      price_table: {
        Row: {
          id: string
          product_id: string
          modality: string
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          modality: string
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          modality?: string
          price?: number
          created_at?: string
        }
      }

      /**
       * 32. CASH_SESSIONS (LEGADO) - Usar work_shifts
       */
      cash_sessions: {
        Row: {
          id: string
          deposit_id: string
          user_id: string
          opened_at: string
          closed_at: string | null
          opening_balance: number
          closing_balance: number | null
          status: 'OPEN' | 'CLOSED'
          created_at: string
        }
        Insert: {
          id?: string
          deposit_id: string
          user_id: string
          opened_at: string
          closed_at?: string | null
          opening_balance: number
          closing_balance?: number | null
          status?: 'OPEN' | 'CLOSED'
          created_at?: string
        }
        Update: {
          id?: string
          deposit_id?: string
          user_id?: string
          opened_at?: string
          closed_at?: string | null
          opening_balance?: number
          closing_balance?: number | null
          status?: 'OPEN' | 'CLOSED'
          created_at?: string
        }
      }

      /**
       * 33. CASH_MOVEMENTS (LEGADO) - Usar cash_flow_entries
       */
      cash_movements: {
        Row: {
          id: string
          session_id: string
          type: 'ENTRADA' | 'SAIDA'
          amount: number
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          type: 'ENTRADA' | 'SAIDA'
          amount: number
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          type?: 'ENTRADA' | 'SAIDA'
          amount?: number
          description?: string
          created_at?: string
        }
      }

      /**
       * 34. FINANCIAL_MOVEMENTS (LEGADO) - Usar cash_flow_entries
       */
      financial_movements: {
        Row: {
          id: string
          deposit_id: string
          type: 'ENTRADA' | 'SAIDA'
          amount: number
          description: string
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          deposit_id: string
          type: 'ENTRADA' | 'SAIDA'
          amount: number
          description: string
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          deposit_id?: string
          type?: 'ENTRADA' | 'SAIDA'
          amount?: number
          description?: string
          reference_id?: string | null
          created_at?: string
        }
      }

      /**
       * 35. RECEIVABLE_TITLES (LEGADO) - Usar accounts_receivable
       */
      receivable_titles: {
        Row: {
          id: string
          client_id: string | null
          description: string
          amount: number
          due_date: string
          paid_date: string | null
          status: 'PENDENTE' | 'PAGO'
          created_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          description: string
          amount: number
          due_date: string
          paid_date?: string | null
          status?: 'PENDENTE' | 'PAGO'
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          description?: string
          amount?: number
          due_date?: string
          paid_date?: string | null
          status?: 'PENDENTE' | 'PAGO'
          created_at?: string
        }
      }
    }
  }
}
