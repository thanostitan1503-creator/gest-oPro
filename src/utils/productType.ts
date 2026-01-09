export const toDbProductType = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;

  // DB usa valores em inglês (compat com dados existentes)
  if (raw === 'VASILHAME_VAZIO' || raw === 'EMPTY_CONTAINER') return 'EMPTY_CONTAINER';
  if (raw === 'GAS_CHEIO' || raw === 'FILLED_GAS') return 'FILLED_GAS';
  if (raw === 'AGUA' || raw === 'WATER') return 'WATER';
  if (raw === 'OUTROS' || raw === 'OTHER' || raw === 'OTHERS') return 'OTHER';
  if (raw === 'SERVICE' || raw === 'SERVICO') return 'SERVICE';

  return raw;
};

export const fromDbProductType = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;

  // App usa PT-BR
  if (raw === 'EMPTY_CONTAINER' || raw === 'VASILHAME_VAZIO') return 'VASILHAME_VAZIO';
  if (raw === 'FILLED_GAS' || raw === 'GAS_CHEIO') return 'GAS_CHEIO';
  if (raw === 'WATER' || raw === 'AGUA') return 'AGUA';
  if (raw === 'OTHER' || raw === 'OTHERS' || raw === 'OUTROS') return 'OUTROS';
  if (raw === 'SERVICE') return 'SERVICE';

  return raw;
};
