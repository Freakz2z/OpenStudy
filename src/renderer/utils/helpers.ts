export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

export function formatDateTime(value: number, locale: string): string {
  return new Date(value).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function downloadMarkdownFile(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
