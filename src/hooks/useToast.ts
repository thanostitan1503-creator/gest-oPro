import { toast } from 'sonner';

/**
 * Hook customizado para feedback visual de operações.
 * Usa sonner para exibir toasts com mensagens de sucesso/erro.
 * 
 * @example
 * const { showSuccess, showError } = useToast();
 * 
 * try {
 *   await depositService.create(data);
 *   showSuccess('Depósito criado com sucesso!');
 * } catch (error) {
 *   showError('Erro ao criar depósito', error);
 * }
 */
export function useToast() {
  /**
   * Exibe toast de sucesso (verde).
   * @param message - Mensagem principal
   * @param description - Descrição opcional
   */
  const showSuccess = (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 3000,
      position: 'top-right',
    });
  };

  /**
   * Exibe toast de erro (vermelho) com detalhes técnicos.
   * Extrai automaticamente mensagens de erro do Supabase.
   * 
   * @param message - Mensagem principal
   * @param error - Objeto de erro (opcional)
   */
  const showError = (message: string, error?: unknown) => {
    let errorDetails = '';

    // Extrair detalhes do erro do Supabase
    if (error && typeof error === 'object') {
      const err = error as any;
      
      // Erro do Supabase
      if (err.message) {
        errorDetails = err.message;
      }
      
      // Detalhes adicionais do Supabase (ex: constraint violations)
      if (err.details) {
        errorDetails += `\n${err.details}`;
      }
      
      // Código do erro do Supabase
      if (err.code) {
        errorDetails += `\nCódigo: ${err.code}`;
      }
      
      // Hint do Supabase (dica de como corrigir)
      if (err.hint) {
        errorDetails += `\nDica: ${err.hint}`;
      }
    }

    toast.error(message, {
      description: errorDetails || 'Sem conexão. Verifique sua internet.',
      duration: 5000,
      position: 'top-right',
    });
  };

  /**
   * Exibe toast de aviso (amarelo).
   * @param message - Mensagem principal
   * @param description - Descrição opcional
   */
  const showWarning = (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
      position: 'top-right',
    });
  };

  /**
   * Exibe toast de informação (azul).
   * @param message - Mensagem principal
   * @param description - Descrição opcional
   */
  const showInfo = (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 3000,
      position: 'top-right',
    });
  };

  /**
   * Exibe toast de loading (spinner).
   * Retorna uma função dismiss() para fechar manualmente.
   * 
   * @example
   * const dismiss = showLoading('Salvando...');
   * try {
   *   await service.save();
   *   dismiss();
   *   showSuccess('Salvo!');
   * } catch (err) {
   *   dismiss();
   *   showError('Erro ao salvar', err);
   * }
   */
  const showLoading = (message: string) => {
    const toastId = toast.loading(message, {
      position: 'top-right',
    });

    return () => toast.dismiss(toastId);
  };

  /**
   * Exibe toast de promessa (loading → success/error automático).
   * Útil para operações assíncronas sem try/catch manual.
   * 
   * @example
   * await showPromise(
   *   depositService.create(data),
   *   {
   *     loading: 'Criando depósito...',
   *     success: 'Depósito criado!',
   *     error: 'Erro ao criar depósito'
   *   }
   * );
   */
  const showPromise = <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: (err) => {
        const error = err as any;
        const details = error?.message || error?.details || 'Erro desconhecido';
        return `${messages.error}: ${details}`;
      },
      position: 'top-right',
    });
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    showPromise,
  };
}
