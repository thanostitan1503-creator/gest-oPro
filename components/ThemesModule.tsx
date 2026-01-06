import React, { useMemo, useRef, useState } from 'react';
import { X, Palette, Check, Image, SlidersHorizontal, Trash2 } from 'lucide-react';
import { THEMES, ThemeId } from '@/domain/themes';

interface ThemesModuleProps {
  onClose: () => void;
  currentTheme: ThemeId;
  onThemeChange: (themeId: ThemeId) => void;
  backgroundImage: string | null;
  backgroundOpacity: number;
  onBackgroundImageChange: (image: string | null) => Promise<void> | void;
  onBackgroundOpacityChange: (value: number) => void;
}

export const ThemesModule: React.FC<ThemesModuleProps> = ({
  onClose,
  currentTheme,
  onThemeChange,
  backgroundImage,
  backgroundOpacity,
  onBackgroundImageChange,
  onBackgroundOpacityChange,
}) => {
  const maxUploadSizeMb = 10;
  const maxUploadSizeBytes = maxUploadSizeMb * 1024 * 1024;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const activeTheme = useMemo(
    () => THEMES.find((theme) => theme.id === currentTheme) || THEMES[0],
    [currentTheme]
  );

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (file.size > maxUploadSizeBytes) {
      setUploadError(`Imagem muito grande. Use até ${maxUploadSizeMb} MB.`);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (result) {
        try {
          await onBackgroundImageChange(result);
        } catch (err) {
          setUploadError('Imagem grande demais para salvar. Use uma imagem menor.');
          console.error('Erro ao aplicar imagem de fundo', err);
        }
      }
    };
    reader.onerror = () => {
      setUploadError('Falha ao ler a imagem. Tente outro arquivo.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.35;
    onBackgroundOpacityChange(clamped);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-surface w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-bdr transform transition-all">
        {/* Header */}
        <div className="bg-app border-b border-bdr px-8 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-pink-100 p-3 rounded-2xl">
              <Palette className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-txt-main tracking-tight">Personalização</h2>
              <p className="text-sm text-txt-muted font-medium">Escolha o visual que mais lhe agrada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full text-txt-muted transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Theme Grid */}
        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-app">
          {THEMES.map((theme) => {
            const isActive = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => onThemeChange(theme.id)}
                className={`relative group flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                  isActive
                    ? 'border-pink-500 bg-surface shadow-lg scale-[1.02]'
                    : 'border-bdr bg-surface hover:border-pink-300 hover:shadow-md'
                }`}
              >
                <div
                  className="w-16 h-16 rounded-xl shadow-inner flex items-center justify-center text-xs font-bold shrink-0 border border-white/10"
                  style={{
                    backgroundColor: theme.colors.appBg,
                    backgroundImage: theme.pattern ?? 'none',
                    color: theme.colors.textMain,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg shadow-sm"
                    style={{ backgroundColor: theme.colors.surfaceBg }}
                  ></div>
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-lg text-txt-main mb-1">{theme.label}</h3>
                  <p className="text-xs text-txt-muted opacity-80">{theme.description}</p>
                </div>

                {isActive && (
                  <div className="absolute top-4 right-4 bg-pink-500 text-white p-1 rounded-full shadow-sm animate-in zoom-in">
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Background Controls */}
        <div className="px-8 pb-8 bg-app space-y-4">
          <div className="bg-surface border border-bdr rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                  <Image className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-txt-main">Imagem de fundo</p>
                  <p className="text-[11px] text-txt-muted">Envie uma imagem e ajuste a transparência</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePickImage}
                  className="px-4 py-2 text-xs font-black uppercase rounded-xl bg-pink-600 text-white shadow-sm hover:bg-pink-700 transition"
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    onBackgroundImageChange(null);
                  }}
                  className="px-3 py-2 text-xs font-black uppercase rounded-xl border border-bdr text-txt-muted hover:text-red-500 hover:border-red-300 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {uploadError && (
              <div className="text-xs text-red-500 font-bold">
                {uploadError}
              </div>
            )}
            {backgroundImage ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-40 h-28 rounded-xl overflow-hidden border border-bdr">
                  <img
                    src={backgroundImage}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    style={{ opacity: backgroundOpacity }}
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-txt-muted">
                    <SlidersHorizontal className="w-4 h-4" />
                    Transparência da imagem
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={backgroundOpacity}
                    onChange={handleOpacityChange}
                    className="w-full accent-pink-500"
                  />
                  <p className="text-[11px] text-txt-muted">{Math.round(backgroundOpacity * 100)}% visível</p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-txt-muted">
                Nenhuma imagem aplicada. O fundo usa o tema {activeTheme.label}.
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="bg-surface border-t border-bdr p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-lg shadow-pink-200 transition-all active:scale-95"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};



