import { useEffect, useState } from 'react';

interface ApiState {
  api: typeof window.api | null;
  error: string | null;
}

let cachedApi: typeof window.api | null | undefined; // undefined = unknown, null = missing

function detectApi(): typeof window.api | null {
  if (cachedApi !== undefined) return cachedApi;
  cachedApi =
    typeof window !== 'undefined' && (window as unknown as { api?: unknown }).api
      ? ((window as unknown as { api: typeof window.api }).api)
      : null;
  return cachedApi;
}

export function useApi(): ApiState {
  const [state, setState] = useState<ApiState>(() => ({
    api: detectApi(),
    error: null,
  }));

  useEffect(() => {
    const api = detectApi();
    if (!api) {
      setState({
        api: null,
        error:
          '预加载脚本（preload）未能加载，window.api 不可用。请重启应用或在终端重新执行 npm run dev。',
      });
    } else {
      setState({ api, error: null });
    }
  }, []);

  return state;
}
