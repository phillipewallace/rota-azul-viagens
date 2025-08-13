
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Verificar se há tema salvo no localStorage
    const savedTheme = localStorage.getItem('mobile-theme') as Theme;
    return savedTheme || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Função para determinar o tema atual
    const getResolvedTheme = (currentTheme: Theme): 'light' | 'dark' => {
      if (currentTheme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return currentTheme;
    };

    // Aplicar tema
    const applyTheme = (currentTheme: Theme) => {
      const resolved = getResolvedTheme(currentTheme);
      setResolvedTheme(resolved);
      
      // Remover classes de tema existentes
      root.classList.remove('light', 'dark');
      
      // Adicionar classe do tema atual
      root.classList.add(resolved);
      
      // Salvar no localStorage
      localStorage.setItem('mobile-theme', currentTheme);
    };

    // Aplicar tema inicial
    applyTheme(theme);

    // Listener para mudanças na preferência do sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme(theme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setThemeWithPersistence = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return {
    theme,
    resolvedTheme,
    setTheme: setThemeWithPersistence,
    themes: ['light', 'dark', 'system'] as const
  };
};
