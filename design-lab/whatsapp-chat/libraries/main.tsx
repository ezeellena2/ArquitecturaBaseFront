import '@fontsource-variable/public-sans';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import 'react-chat-elements/dist/main.css';
import '@syncfusion/ej2-fluent2-theme/styles/chat-ui/index.css';
import './styles.css';
import { User } from 'oidc-client-ts';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { authConfig } from '@/auth/authConfig';
import { AppLayout } from '@/layouts/AppLayout';
import i18n from '@/shared/i18n';
import { installVisualFixtures } from '@/test/visual/fixtures';
import { Comparison } from './Comparison';
import { copy, language } from './copy';

installVisualFixtures(language, 'chat');
await i18n.loadLanguages(['es', 'en']);
for (const lang of ['es', 'en'] as const) i18n.addResourceBundle(lang, 'chatLibraryLab', copy[lang]);
await i18n.changeLanguage(language);
const user = new User({ access_token: 'whatsapp-library-mock-only', token_type: 'Bearer', expires_at: 4102444800,
  profile: { sub: 'visual-test', iss: location.origin, aud: 'web', exp: 4102444800, iat: 1790800000 } });
await authConfig.userStore?.set(`user:${location.origin}:web`, user.toStorageString());
const router = createMemoryRouter([{ Component: AppLayout, children: [{ path: '*', Component: Comparison }] }], { initialEntries: ['/whatsapp/chat'] });
createRoot(document.getElementById('root')!).render(<AppProviders><RouterProvider router={router}/></AppProviders>);
