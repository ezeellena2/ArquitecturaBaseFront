import '@fontsource-variable/public-sans';
import './styles.css';
import './utilities.css';
import { User } from 'oidc-client-ts';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { authConfig } from '@/auth/authConfig';
import { AppLayout } from '@/layouts/AppLayout';
import i18n from '@/shared/i18n';
import { installVisualFixtures } from '@/test/visual/fixtures';
import Comparison from './Comparison';
import ChosenStateBoard from './ChosenStateBoard';
import { language } from './copy';

document.documentElement.lang=language;
installVisualFixtures(language,'chat');
await i18n.loadLanguages(['es','en']);await i18n.changeLanguage(language);
const user=new User({access_token:'library-design-lab-only',token_type:'Bearer',expires_at:4102444800,profile:{sub:'visual-test',iss:location.origin,aud:'web',exp:4102444800,iat:1790800000}});
await authConfig.userStore?.set(`user:${location.origin}:web`,user.toStorageString());
const router=createMemoryRouter([{Component:AppLayout,children:[{path:'*',Component:new URLSearchParams(location.search).has('board') ? ChosenStateBoard : Comparison}]}]);
createRoot(document.getElementById('root')!).render(<AppProviders><RouterProvider router={router}/></AppProviders>);

