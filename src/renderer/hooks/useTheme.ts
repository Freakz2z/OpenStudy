import { useEffect, useState } from 'react';

export type EffectiveTheme = 'light' | 'dark';

function detectTheme(): EffectiveTheme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * 响应系统/用户主题变化，返回 'light' | 'dark'。
 * 用于：logo 切换、深色专属组件、conditional styling。
 */
export function useTheme(): EffectiveTheme {
  const [theme, setTheme] = useState<EffectiveTheme>(detectTheme);
  useEffect(() => {
    function update() {
      setTheme(detectTheme());
    }
    update();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      mq.removeEventListener('change', update);
      obs.disconnect();
    };
  }, []);
  return theme;
}