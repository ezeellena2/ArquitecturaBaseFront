import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WhatsAppChatPage } from '@/features/whatsapp/pages/WhatsAppChatPage';
import { Button } from '@/shared/ui/button';

export function ShapeComparison() {
  const { t, i18n } = useTranslation('chatShapeLab');
  const [shape, setShape] = useState(() => new URLSearchParams(location.search).get('shape') === 'current' ? 'current' : 'rounded');
  const screen = useRef<HTMLDivElement>(null);

  // El arnés abre un contacto ficticio una sola vez; la página productiva es original.
  useEffect(() => {
    const element = screen.current!;
    const select = () => {
      const contact = element.querySelector<HTMLButtonElement>('button[aria-label="Ana Martínez"]');
      if (!contact) return;
      observer.disconnect();
      contact.click();
    };
    const observer = new MutationObserver(select);
    observer.observe(element, { childList: true, subtree: true });
    select();
    return () => observer.disconnect();
  }, []);

  function choose(value: string) {
    setShape(value);
    const url = new URL(location.href);
    url.searchParams.set('shape', value);
    history.replaceState(null, '', url);
  }

  async function changeLanguage(value: 'es' | 'en') {
    await i18n.changeLanguage(value);
    const url = new URL(location.href);
    url.searchParams.set('lang', value);
    history.replaceState(null, '', url);
  }

  return <>
    <div className="shape-lab-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
      <div><p className="text-sm font-semibold">{t('title')}</p><p className="text-xs text-[var(--color-content-muted)]">{t('description')}</p></div>
      <div className="flex flex-wrap items-center gap-4">
        <div role="group" aria-label={t('label')} className="flex gap-2">
          <Button size="sm" variant={shape === 'current' ? 'default' : 'outline'} aria-pressed={shape === 'current'} onClick={() => choose('current')}>{t('current')}</Button>
          <Button size="sm" variant={shape === 'rounded' ? 'default' : 'outline'} aria-pressed={shape === 'rounded'} onClick={() => choose('rounded')}>{t('rounded')}</Button>
        </div>
        <div role="group" aria-label={t('language')} className="flex gap-1">
          {(['es', 'en'] as const).map(value => <Button key={value} size="sm" variant="ghost" aria-pressed={i18n.resolvedLanguage === value} onClick={() => void changeLanguage(value)}>{value.toUpperCase()}</Button>)}
        </div>
      </div>
    </div>
    <div ref={screen} className="shape-lab-screen" data-bubble-shape={shape}><WhatsAppChatPage /></div>
  </>;
}
