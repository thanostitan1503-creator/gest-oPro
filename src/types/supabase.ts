export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts_receivable: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string | null
          deposit_id: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_id: string | null
          original_amount: number
          paid_amount: number | null
          remaining_amount: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          deposit_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          original_amount: number
          paid_amount?: number | null
          remaining_amount?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          deposit_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          original_amount?: number
          paid_amount?: number | null
          remaining_amount?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changes: Json | null
          created_at: string | null
          deposit_id: string | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changes?: Json | null
          created_at?: string | null
          deposit_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changes?: Json | null
          created_at?: string | null
          deposit_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      boletos: {
        Row: {
          amount: number
          bank_name: string | null
          barcode: string | null
          created_at: string | null
          digitable_line: string | null
          due_date: string | null
          id: string
          issue_date: string | null
          pdf_url: string | null
          receivable_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          barcode?: string | null
          created_at?: string | null
          digitable_line?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string | null
          pdf_url?: string | null
          receivable_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          barcode?: string | null
          created_at?: string | null
          digitable_line?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string | null
          pdf_url?: string | null
          receivable_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boletos_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_entries: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          deposit_id: string
          description: string | null
          direction: string
          id: string
          payment_method: string | null
          reference_id: string | null
          shift_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          deposit_id: string
          description?: string | null
          direction: string
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          shift_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          deposit_id?: string
          description?: string | null
          direction?: string
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          shift_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_entries_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_entries_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_session_id: string
          created_at: string | null
          description: string | null
          id: string
          order_id: string | null
          type: string
        }
        Insert: {
          amount: number
          cash_session_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          cash_session_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          current_balance: number | null
          deposit_id: string
          id: string
          opened_at: string | null
          opening_balance: number | null
          operator_id: string
          status: string | null
        }
        Insert: {
          closed_at?: string | null
          current_balance?: number | null
          deposit_id: string
          id?: string
          opened_at?: string | null
          opening_balance?: number | null
          operator_id: string
          status?: string | null
        }
        Update: {
          closed_at?: string | null
          current_balance?: number | null
          deposit_id?: string
          id?: string
          opened_at?: string | null
          opening_balance?: number | null
          operator_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      client_one_time_benefits: {
        Row: {
          benefit_type: string | null
          client_id: string
          created_at: string | null
          discount_percent: number | null
          discount_value: number | null
          expires_at: string | null
          id: string
          status: string | null
          used_at: string | null
          used_in_order_id: string | null
        }
        Insert: {
          benefit_type?: string | null
          client_id: string
          created_at?: string | null
          discount_percent?: number | null
          discount_value?: number | null
          expires_at?: string | null
          id?: string
          status?: string | null
          used_at?: string | null
          used_in_order_id?: string | null
        }
        Update: {
          benefit_type?: string | null
          client_id?: string
          created_at?: string | null
          discount_percent?: number | null
          discount_value?: number | null
          expires_at?: string | null
          id?: string
          status?: string | null
          used_at?: string | null
          used_in_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_one_time_benefits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_one_time_benefits_used_in_order_id_fkey"
            columns: ["used_in_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      client_price_overrides: {
        Row: {
          client_id: string
          created_at: string | null
          deposit_id: string | null
          id: string
          is_active: boolean | null
          modality: string | null
          override_price: number | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          is_active?: boolean | null
          modality?: string | null
          override_price?: number | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          is_active?: boolean | null
          modality?: string | null
          override_price?: number | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_price_overrides_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_price_overrides_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_price_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean | null
          address: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string | null
          delivery_zone_id: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          reference: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          delivery_zone_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          reference?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          delivery_zone_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_clients_delivery_zone"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_jobs: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          created_at: string | null
          deposit_id: string
          driver_id: string | null
          id: string
          notes: string | null
          order_id: string
          priority: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          deposit_id: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id: string
          priority?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          deposit_id?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          priority?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_jobs_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_sectors: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          zone_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          zone_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_sectors_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      deposits: {
        Row: {
          active: boolean | null
          address: string | null
          color: string | null
          created_at: string | null
          free_shipping_min_value: number | null
          id: string
          is_active: boolean | null
          name: string
          require_stock_audit: boolean | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          color?: string | null
          created_at?: string | null
          free_shipping_min_value?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          require_stock_audit?: boolean | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          color?: string | null
          created_at?: string | null
          free_shipping_min_value?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          require_stock_audit?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_presence: {
        Row: {
          deposit_id: string | null
          driver_id: string
          id: string
          last_seen_at: string | null
          status: string | null
        }
        Insert: {
          deposit_id?: string | null
          driver_id: string
          id?: string
          last_seen_at?: string | null
          status?: string | null
        }
        Update: {
          deposit_id?: string | null
          driver_id?: string
          id?: string
          last_seen_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_presence_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_presence_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean | null
          cpf: string | null
          created_at: string | null
          deposit_id: string | null
          id: string
          is_active: boolean | null
          name: string
          password: string | null
          permissions: string[] | null
          phone: string | null
          role: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          cpf?: string | null
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          password?: string | null
          permissions?: string[] | null
          phone?: string | null
          role?: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          cpf?: string | null
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          password?: string | null
          permissions?: string[] | null
          phone?: string | null
          role?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          alert_days_before: number | null
          amount: number
          category: string | null
          created_at: string | null
          deposit_id: string | null
          description: string
          due_date: string | null
          id: string
          paid_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          alert_days_before?: number | null
          amount: number
          category?: string | null
          created_at?: string | null
          deposit_id?: string | null
          description: string
          due_date?: string | null
          id?: string
          paid_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_days_before?: number | null
          amount?: number
          category?: string | null
          created_at?: string | null
          deposit_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          paid_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          payment_method_id: string | null
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          payment_method_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          payment_method_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_movements_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_settings: {
        Row: {
          id: string
          monthly_goal: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          monthly_goal?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          monthly_goal?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kv: {
        Row: {
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string | null
          deposit_id: string | null
          id: string
          is_active: boolean | null
          name: string
          serial_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          serial_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          serial_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          action: string
          attempts: number | null
          created_at: string | null
          entity: string
          entity_id: string
          id: string
          last_error: string | null
          payload: Json | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action: string
          attempts?: number | null
          created_at?: string | null
          entity: string
          entity_id: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string
          attempts?: number | null
          created_at?: string | null
          entity?: string
          entity_id?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_method_deposit_config: {
        Row: {
          created_at: string | null
          deposit_id: string
          due_days: number
          id: string
          is_active: boolean
          payment_method_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_id: string
          due_days?: number
          id?: string
          is_active?: boolean
          payment_method_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_id?: string
          due_days?: number
          id?: string
          is_active?: boolean
          payment_method_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_deposit_config_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_method_deposit_config_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string | null
          generates_receivable: boolean | null
          id: string
          is_active: boolean | null
          method_kind: string
          name: string
          receipt_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          generates_receivable?: boolean | null
          id?: string
          is_active?: boolean | null
          method_kind?: string
          name: string
          receipt_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          generates_receivable?: boolean | null
          id?: string
          is_active?: boolean | null
          method_kind?: string
          name?: string
          receipt_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      price_table: {
        Row: {
          created_at: string | null
          default_price: number
          id: string
          modality: string
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_price: number
          id?: string
          modality: string
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_price?: number
          id?: string
          modality?: string
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_table_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_exchange_rules: {
        Row: {
          created_at: string | null
          deposit_id: string
          id: string
          is_active: boolean | null
          product_id: string
          return_product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_id: string
          id?: string
          is_active?: boolean | null
          product_id: string
          return_product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_id?: string
          id?: string
          is_active?: boolean | null
          product_id?: string
          return_product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_exchange_rules_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_exchange_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_exchange_rules_return_product_id_fkey"
            columns: ["return_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing: {
        Row: {
          created_at: string | null
          deposit_id: string
          exchange_price: number | null
          full_price: number | null
          id: string
          mode: string | null
          price: number
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_id: string
          exchange_price?: number | null
          full_price?: number | null
          id?: string
          mode?: string | null
          price: number
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_id?: string
          exchange_price?: number | null
          full_price?: number | null
          id?: string
          mode?: string | null
          price?: number
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          code: string | null
          cost_price: number | null
          created_at: string | null
          deposit_id: string | null
          description: string | null
          exchange_price: number | null
          full_price: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_delivery_fee: boolean | null
          markup: number | null
          movement_type: string | null
          name: string
          product_group: string | null
          return_product_id: string | null
          sale_price: number | null
          track_stock: boolean | null
          tracks_empties: boolean | null
          type: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          cost_price?: number | null
          created_at?: string | null
          deposit_id?: string | null
          description?: string | null
          exchange_price?: number | null
          full_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_delivery_fee?: boolean | null
          markup?: number | null
          movement_type?: string | null
          name: string
          product_group?: string | null
          return_product_id?: string | null
          sale_price?: number | null
          track_stock?: boolean | null
          tracks_empties?: boolean | null
          type?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          cost_price?: number | null
          created_at?: string | null
          deposit_id?: string | null
          description?: string | null
          exchange_price?: number | null
          full_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_delivery_fee?: boolean | null
          markup?: number | null
          movement_type?: string | null
          name?: string
          product_group?: string | null
          return_product_id?: string | null
          sale_price?: number | null
          track_stock?: boolean | null
          tracks_empties?: boolean | null
          type?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_return_product_id_fkey"
            columns: ["return_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_items: {
        Row: {
          created_at: string | null
          id: string
          is_special_price: boolean | null
          modality: string | null
          order_id: string
          product_id: string
          quantity: number
          sale_movement_type: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_special_price?: boolean | null
          modality?: string | null
          order_id: string
          product_id: string
          quantity?: number
          sale_movement_type?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_special_price?: boolean | null
          modality?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          sale_movement_type?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          machine_id: string | null
          machine_name: string | null
          order_id: string
          payment_method_id: string | null
          payment_method_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          machine_id?: string | null
          machine_name?: string | null
          order_id: string
          payment_method_id?: string | null
          payment_method_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          machine_id?: string | null
          machine_name?: string | null
          order_id?: string
          payment_method_id?: string | null
          payment_method_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          completed_at: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_status: string | null
          delivery_zone_id: string | null
          deposit_id: string
          discount: number | null
          driver_id: string | null
          driver_name: string | null
          id: string
          order_number: string
          service_type: string
          status: string | null
          subtotal: number | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          completed_at?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_status?: string | null
          delivery_zone_id?: string | null
          deposit_id: string
          discount?: number | null
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          order_number: string
          service_type?: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          completed_at?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_status?: string | null
          delivery_zone_id?: string | null
          deposit_id?: string
          discount?: number | null
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          order_number?: string
          service_type?: string
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_stock_audits: {
        Row: {
          closing_quantity: number | null
          created_at: string | null
          deposit_id: string
          difference: number | null
          id: string
          opening_quantity: number | null
          product_id: string
          shift_id: string | null
          sold_quantity: number | null
        }
        Insert: {
          closing_quantity?: number | null
          created_at?: string | null
          deposit_id: string
          difference?: number | null
          id?: string
          opening_quantity?: number | null
          product_id: string
          shift_id?: string | null
          sold_quantity?: number | null
        }
        Update: {
          closing_quantity?: number | null
          created_at?: string | null
          deposit_id?: string
          difference?: number | null
          id?: string
          opening_quantity?: number | null
          product_id?: string
          shift_id?: string | null
          sold_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_stock_audits_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_stock_audits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_stock_audits_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balance: {
        Row: {
          deposit_id: string
          id: string
          product_id: string
          quantity: number | null
          updated_at: string | null
        }
        Insert: {
          deposit_id: string
          id?: string
          product_id: string
          quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          deposit_id?: string
          id?: string
          product_id?: string
          quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_balance_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balance_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          count_id: string
          counted_quantity: number
          created_at: string | null
          difference: number | null
          id: string
          product_id: string
          system_quantity: number | null
        }
        Insert: {
          count_id: string
          counted_quantity: number
          created_at?: string | null
          difference?: number | null
          id?: string
          product_id: string
          system_quantity?: number | null
        }
        Update: {
          count_id?: string
          counted_quantity?: number
          created_at?: string | null
          difference?: number | null
          id?: string
          product_id?: string
          system_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          closed_at: string | null
          created_at: string | null
          deposit_id: string
          id: string
          status: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          deposit_id: string
          id?: string
          status?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          deposit_id?: string
          id?: string
          status?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          deposit_id: string
          id: string
          origin: string | null
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          type: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_id: string
          id?: string
          origin?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          type: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_id?: string
          id?: string
          origin?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          type?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          completed_at: string | null
          created_at: string | null
          destination_deposit_id: string
          id: string
          notes: string | null
          origin_deposit_id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          destination_deposit_id: string
          id?: string
          notes?: string | null
          origin_deposit_id: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          destination_deposit_id?: string
          id?: string
          notes?: string | null
          origin_deposit_id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_destination_deposit_id_fkey"
            columns: ["destination_deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_origin_deposit_id_fkey"
            columns: ["origin_deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      work_shifts: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          declared_card: number | null
          declared_cash: number | null
          declared_pix: number | null
          deposit_id: string
          discrepancy: number | null
          id: string
          opened_at: string | null
          opening_balance: number | null
          status: string | null
          system_card: number | null
          system_cash: number | null
          system_pix: number | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          declared_card?: number | null
          declared_cash?: number | null
          declared_pix?: number | null
          deposit_id: string
          discrepancy?: number | null
          id?: string
          opened_at?: string | null
          opening_balance?: number | null
          status?: string | null
          system_card?: number | null
          system_cash?: number | null
          system_pix?: number | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          declared_card?: number | null
          declared_cash?: number | null
          declared_pix?: number | null
          deposit_id?: string
          discrepancy?: number | null
          id?: string
          opened_at?: string | null
          opening_balance?: number | null
          status?: string | null
          system_card?: number | null
          system_cash?: number | null
          system_pix?: number | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_shifts_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_pricing: {
        Row: {
          created_at: string | null
          deposit_id: string
          id: string
          price: number
          updated_at: string | null
          zone_id: string
        }
        Insert: {
          created_at?: string | null
          deposit_id: string
          id?: string
          price?: number
          updated_at?: string | null
          zone_id: string
        }
        Update: {
          created_at?: string | null
          deposit_id?: string
          id?: string
          price?: number
          updated_at?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_pricing_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_pricing_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_audit_dashboard_stats:
        | { Args: never; Returns: Json }
        | { Args: { target_deposit_id?: string }; Returns: Json }
      get_delivery_fee: {
        Args: { target_deposit_id: string; target_zone_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
