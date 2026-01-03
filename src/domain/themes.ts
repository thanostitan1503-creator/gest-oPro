export type ThemeId =
  | 'light'
  | 'oled'
  | 'dracula'
  | 'ocean'
  | 'forest'
  | 'ember'
  | 'sunset'
  | 'aurora'
  | 'nebula';

export interface Theme {
  id: ThemeId;
  label: string;
  description: string;
  pattern?: string;
  colors: {
    appBg: string;      // Fundo principal da aplicação
    surfaceBg: string;  // Fundo de cartões e modais
    textMain: string;   // Texto principal
    textMuted: string;  // Texto secundário
    border: string;     // Cor de bordas
    primary: string;    // Cor de destaque (ícones, botões principais)
  };
}

export const THEMES: Theme[] = [
  {
    id: 'light',
    label: 'Padrão (Claro)',
    description: 'Visual clássico e limpo',
    colors: {
      appBg: '#f8fafc',
      surfaceBg: '#ffffff',
      textMain: '#0f172a',
      textMuted: '#64748b',
      border: '#e2e8f0',
      primary: '#4f46e5',
    },
  },
  {
    id: 'oled',
    label: 'OLED (Preto Profundo)',
    description: 'Economia máxima de energia',
    colors: {
      appBg: '#000000',
      surfaceBg: '#000000',
      textMain: '#f8fafc',
      textMuted: '#cbd5e1',
      border: '#333333',
      primary: '#22d3ee',
    },
  },
  {
    id: 'dracula',
    label: 'Dracula (Roxo)',
    description: 'Tema escuro com contraste suave',
    colors: {
      appBg: '#0f172a',
      surfaceBg: '#1e293b',
      textMain: '#f1f5f9',
      textMuted: '#cbd5e1',
      border: '#334155',
      primary: '#a78bfa',
    },
  },
  {
    id: 'ocean',
    label: 'Oceano Profundo',
    description: 'Azuis profundos com brilho frio',
    colors: {
      appBg: '#082f49',
      surfaceBg: '#0c4a6e',
      textMain: '#f0f9ff',
      textMuted: '#e0f2fe',
      border: '#075985',
      primary: '#38bdf8',
    },
  },
  {
    id: 'forest',
    label: 'Floresta Noturna',
    description: 'Verdes escuros com atmosfera natural',
    colors: {
      appBg: '#022c22',
      surfaceBg: '#064e3b',
      textMain: '#ecfdf5',
      textMuted: '#d1fae5',
      border: '#065f46',
      primary: '#34d399',
    },
  },
  {
    id: 'ember',
    label: 'Brasa (Preto & Laranja)',
    description: 'Preto intenso com brilho quente',
    colors: {
      appBg: '#0c0a09',
      surfaceBg: '#1c1917',
      textMain: '#ffedd5',
      textMuted: '#d6d3d1',
      border: '#44403c',
      primary: '#f97316',
    },
  },
  {
    id: 'sunset',
    label: 'Pôr do Sol',
    description: 'Gradiente quente com tons de rosa e laranja',
    pattern:
      'radial-gradient(circle at 20% 20%, rgba(251, 146, 60, 0.35), transparent 55%), radial-gradient(circle at 80% 30%, rgba(244, 114, 182, 0.25), transparent 60%), radial-gradient(circle at 50% 80%, rgba(253, 186, 116, 0.2), transparent 65%)',
    colors: {
      appBg: '#1b0b14',
      surfaceBg: '#2a141f',
      textMain: '#fff1f2',
      textMuted: '#fecdd3',
      border: '#3f1c2b',
      primary: '#fb7185',
    },
  },
  {
    id: 'aurora',
    label: 'Aurora Boreal',
    description: 'Neblinas frias com tons de ciano e verde',
    pattern:
      'radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.35), transparent 55%), radial-gradient(circle at 80% 30%, rgba(16, 185, 129, 0.3), transparent 60%), radial-gradient(circle at 50% 80%, rgba(139, 92, 246, 0.25), transparent 65%)',
    colors: {
      appBg: '#0b1020',
      surfaceBg: '#131a2d',
      textMain: '#e2e8f0',
      textMuted: '#94a3b8',
      border: '#1f2937',
      primary: '#22d3ee',
    },
  },
  {
    id: 'nebula',
    label: 'Nebulosa Roxa',
    description: 'Brilhos roxos com contraste espacial',
    pattern:
      'radial-gradient(circle at 15% 25%, rgba(217, 70, 239, 0.28), transparent 55%), radial-gradient(circle at 75% 70%, rgba(99, 102, 241, 0.3), transparent 60%), radial-gradient(circle at 50% 40%, rgba(14, 165, 233, 0.2), transparent 65%)',
    colors: {
      appBg: '#120b24',
      surfaceBg: '#1c1236',
      textMain: '#f5f3ff',
      textMuted: '#d8b4fe',
      border: '#312e81',
      primary: '#c084fc',
    },
  },
];
