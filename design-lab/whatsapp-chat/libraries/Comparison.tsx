import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '@/shared/ui/Page';
import { Surface } from '@/shared/ui/Surface';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/NativeSelect';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Spinner } from '@/shared/ui/Spinner';
import { useDemo, scenes, type Scene } from './demo';
import { KitConversations, KitComposer, KitHeader, KitHistory, type Library } from './ChatKits';
import { language } from './copy';
import { NativeStage } from './NativeKits';

const libraries: Library[] = ['current', 'chatscope-adapted', 'elements', 'chatscope', 'syncfusion'];
const activeLibraries: Library[] = ['chatscope', 'syncfusion'];
export function Comparison() {
  const { t } = useTranslation('chatLibraryLab');
  const query = new URLSearchParams(location.search);
  const initialLibrary = query.get('library');
  const initialScene = query.get('scene');
  const [library, setLibrary] = useState<Library>(libraries.includes(initialLibrary as Library) ? initialLibrary as Library : 'chatscope');
  const demo = useDemo(scenes.includes(initialScene as Scene) ? initialScene as Scene : 'conversation');
  const names = { current: t('current'), 'chatscope-adapted': t('previous'), chatscope: 'Chatscope', elements: 'React Chat Elements', syncfusion: 'Syncfusion' };
  function update(nextLibrary: Library, scene: Scene) {
    const url = new URL(location.href); url.searchParams.set('library', nextLibrary); url.searchParams.set('scene', scene);
    window.history.replaceState(null, '', url);
  }
  function choose(next: Library) { setLibrary(next); update(next, demo.scene); }
  function scene(next: Scene) { demo.changeScene(next); update(library, next); }
  const unavailable = ['empty', 'loading', 'error'].includes(demo.scene);
  const filters = <div className="kit-inbox-filters"><label className="sr-only" htmlFor="kit-search">{t('search')}</label>
    <Input id="kit-search" value={demo.search} placeholder={t('search')} onChange={event => demo.setSearch(event.target.value)}/>
    <SegmentedControl aria-label={t('chats')} fullWidth options={[
      { key: 'all', label: `${t('all')} (4)`, pressed: !demo.unread, onSelect: () => demo.setUnread(false) },
      { key: 'unread', label: `${t('unread')} (2)`, pressed: demo.unread, onSelect: () => demo.setUnread(true) },
    ]}/>
  </div>;
  return <>
    <div className="kit-lab-toolbar" aria-label={t('lab')}>
      <div className="kit-lab-options">{activeLibraries.map(key => <Button key={key} size="sm" variant={library === key ? 'default' : 'ghost'} aria-pressed={library === key} onClick={() => choose(key)}>{names[key]}</Button>)}</div>
      <div className="kit-lab-controls"><NativeSelect aria-label={t('scene')} value={demo.scene} onChange={event => scene(event.target.value as Scene)}>
        {scenes.map(key => <option key={key} value={key}>{t(`scenes.${key}`)}</option>)}
      </NativeSelect><a aria-label={t('language')} href={`?library=${library}&scene=${demo.scene}&lang=${language === 'es' ? 'en' : 'es'}`}>{language === 'es' ? 'EN' : 'ES'}</a></div>
    </div>
    <Page title={t('title')} status={<span className="kit-preview-label">{t('preview')}</span>} actions={<>
      <Button variant="outline" size="sm" onClick={() => scene('conversation')}>{t('reset')}</Button>
      <Button variant="outline" size="sm" disabled={!demo.contact || unavailable} onClick={demo.arrive}>{t('arrival')}</Button>
    </>}>
      <Surface>
        {!unavailable && (library === 'chatscope' || library === 'syncfusion') ? <NativeStage library={library} demo={demo} filters={filters}/> :
        <div className="kit-stage" data-library={library} data-selected={Boolean(demo.contact)}>
          {unavailable ? <div className="kit-stage-state">
            {demo.scene === 'loading' ? <div className="kit-loading" role="status"><Spinner decorative/><p>{t('loading')}</p></div> :
              demo.scene === 'error' ? <EmptyState embedded title={t('errorTitle')} description={t('errorHelp')} action={<Button variant="outline" onClick={() => scene('conversation')}>{t('retry')}</Button>}/> :
                <EmptyState embedded title={t('emptyTitle')} description={t('emptyHelp')}/>}
          </div> : <>
            <aside className="kit-inbox" aria-label={t('chats')}>
              {filters}
              <div className="kit-conversations">{demo.filtered.length ? <KitConversations library={library} demo={demo}/> :
                <EmptyState embedded title={t('noResults')} action={<Button variant="outline" size="sm" onClick={() => { demo.setSearch(''); demo.setUnread(false); }}>{t('clear')}</Button>}/>}</div>
            </aside>
            <section className="kit-thread" aria-label={demo.contact?.name ?? t('selectTitle')}>
              {demo.contact ? <><KitHeader library={library} demo={demo}/><KitHistory library={library} demo={demo}/><KitComposer library={library} demo={demo}/></> :
                <div className="kit-stage-state"><EmptyState embedded title={t('selectTitle')} description={t('selectHelp')}/></div>}
            </section>
          </>}
        </div>}
      </Surface>
      <div className="kit-lab-caption"><p>{t(`${library}Detail`)}</p><span>{t('note')}</span>
        <a href={`?library=chatscope-adapted&scene=${demo.scene}&lang=${language}`}>{t('previous')}</a>
      </div>
    </Page>
    <ConfirmDialog open={demo.reviewOpen} onOpenChange={demo.setReviewOpen} title={t('reviewTitle')} description={t('reviewHelp')}
      confirmLabel={t('confirm')} cancelLabel={t('cancel')} onConfirm={demo.review}/>
  </>;
}
