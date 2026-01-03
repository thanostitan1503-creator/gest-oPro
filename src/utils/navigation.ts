export const Maps = (link: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gp:navigate', { detail: link }));
};
