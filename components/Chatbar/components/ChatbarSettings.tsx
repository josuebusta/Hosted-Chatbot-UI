import {
  IconBrandFacebook,
  IconFileExport,
  IconLogin,
  IconMoon,
  IconSun,
  IconArticle
} from '@tabler/icons-react';
import { useContext } from 'react';

import { useTranslation } from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';

import { Import } from '../../Settings/Import';
import { SidebarButton } from '../../Sidebar/SidebarButton';
import ChatbarContext from '../Chatbar.context';
import { ClearConversations } from './ClearConversations';

export const ChatbarSettings = () => {
  const { t } = useTranslation('sidebar');

  const {
    state: { lightMode, conversations, user },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const {
    handleClearConversations,
    handleImportConversations,
    handleExportData,
  } = useContext(ChatbarContext);

  const signInAccountOnClick = () => {
    if (user) {
      homeDispatch({
        field: 'showProfileModel',
        value: true,
      });
    } else {
      homeDispatch({
        field: 'showLoginSignUpModel',
        value: true,
      });
    }
  };

  return (
    <div className="flex flex-col items-center space-y-1 border-t border-white/20 pt-1 text-sm">
      {conversations.length > 0 ? (
        <ClearConversations onClearConversations={handleClearConversations} />
      ) : null}

      <Import onImport={handleImportConversations} />

      <SidebarButton
        text={t('Export data')}
        icon={<IconFileExport size={18} />}
        onClick={() => handleExportData()}
      />

      <SidebarButton
        text={lightMode === 'light' ? t('Dark mode') : t('Light mode')}
        icon={
          lightMode === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />
        }
        onClick={() =>
          homeDispatch({
            field: 'lightMode',
            value: lightMode === 'light' ? 'dark' : 'light',
          })
        }
      />
      <SidebarButton
        text={user ? t('Account') : t('Sign in')}
        icon={user ? <IconArticle size={18} /> : <IconLogin size={18} />}
        onClick={signInAccountOnClick}
      />
      <SidebarButton
        text={t('Follow for updates!')}
        icon={<IconBrandFacebook size={18} />}
        onClick={() => {
          window.open(
            'https://www.facebook.com/groups/621367689441014',
            '_blank',
          );
        }}
      />
    </div>
  );
};
