import '@fontsource-variable/public-sans';
import './shapes.css';
import { User } from 'oidc-client-ts';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { authConfig } from '@/auth/authConfig';
import { AppLayout } from '@/layouts/AppLayout';
import i18n from '@/shared/i18n';
import { installVisualFixtures } from '@/test/visual/fixtures';
import { ShapeComparison } from './ShapeComparison';
import { shapeCopy } from './shapeCopy';
import { installShapeFixtures } from './shapeFixtures';

const parameters = new URLSearchParams(location.search);
const language = parameters.get('lang') === 'en' ? 'en' : 'es';
const scenario = parameters.get('scenario');
installVisualFixtures(language, ['chat-states', 'chat-history', 'chat-access'].includes(scenario ?? '') ? scenario : 'chat');
installShapeFixtures(language, scenario);
await i18n.loadLanguages(['es', 'en']);
for (const lang of ['es', 'en'] as const) i18n.addResourceBundle(lang, 'chatShapeLab', shapeCopy[lang]);
await i18n.changeLanguage(language);
document.documentElement.lang = language;
const user = new User({ access_token: 'whatsapp-shape-mock-only', token_type: 'Bearer', expires_at: 4102444800,
  profile: { sub: 'visual-test', iss: location.origin, aud: 'web', exp: 4102444800, iat: 1790800000 } });
await authConfig.userStore?.set(`user:${location.origin}:web`, user.toStorageString());
const router = createMemoryRouter([{ Component: AppLayout, children: [{ path: '*', Component: ShapeComparison }] }], { initialEntries: ['/whatsapp/chat'] });
createRoot(document.getElementById('root')!).render(<AppProviders><RouterProvider router={router}/></AppProviders>);
