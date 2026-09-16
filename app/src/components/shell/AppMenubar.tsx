import { useTranslation } from 'react-i18next'
import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarTrigger,
} from '@/components/ui/menubar'
import { useSidebar } from '@/components/ui/sidebar'
import {
  setLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/lib/i18n'
import type { FunctionId } from './AppShell'

const NATIVE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  pt: 'Português',
}

const FUNCTION_IDS: FunctionId[] = [
  'editor',
  'calculator',
  'research',
  'chatbot',
  'settings',
]

interface AppMenubarProps {
  onOpenTab: (id: FunctionId) => void
  onOpenFolder: () => void
  onOpenSettings: () => void
  onTogglePanel: () => void
  panelOpen: boolean
  onLogout: () => void
}

function AppMenubar({
  onOpenTab,
  onOpenFolder,
  onOpenSettings,
  onTogglePanel,
  panelOpen,
  onLogout,
}: AppMenubarProps) {
  const { t, i18n } = useTranslation()
  const { toggleSidebar, state, isMobile } = useSidebar()
  const lang = i18n.language.split('-')[0] === 'pt' ? 'pt' : 'en'
  const names: Record<FunctionId, string> = {
    editor: t('shell.editor'),
    calculator: t('shell.calculator'),
    research: t('shell.research'),
    chatbot: t('shell.chatbot'),
    settings: t('shell.settings'),
  }

  function changeLanguage(value: unknown): void {
    if (value === 'en' || value === 'pt') {
      setLanguage(value).catch(() => {
        // Language already applied for this session via i18n.
      })
    }
  }

  return (
    <div
      className="transition-[padding] duration-200 ease-linear"
      style={{ paddingLeft: isMobile ? 0 : state === 'collapsed' ? 48 : 256 }}
    >
    <Menubar className="rounded-none border-x-0 border-t-0">
      <MenubarMenu>
        <MenubarTrigger>{t('menubar.file')}</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            {FUNCTION_IDS.filter((id) => id !== 'settings').map((id) => (
              <MenubarItem key={id} onClick={() => onOpenTab(id)}>
                {names[id]}
              </MenubarItem>
            ))}
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem onClick={onOpenFolder}>
              {t('menubar.openFolder')}
            </MenubarItem>
            <MenubarItem
              onClick={() => window.dispatchEvent(new CustomEvent('stdhub:save'))}
            >
              {t('menubar.save')}
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarItem onClick={onLogout}>{t('platform.logout')}</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>{t('menubar.edit')}</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem
              onClick={() => window.dispatchEvent(new CustomEvent('stdhub:undo'))}
            >
              {t('menubar.undo')}
            </MenubarItem>
            <MenubarItem
              onClick={() => window.dispatchEvent(new CustomEvent('stdhub:redo'))}
            >
              {t('menubar.redo')}
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>{t('menubar.view')}</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem onClick={toggleSidebar}>
              {t('menubar.toggleSidebar')}
            </MenubarItem>
            <MenubarItem onClick={onTogglePanel}>
              {panelOpen ? t('menubar.hidePanel') : t('menubar.showPanel')}
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>{t('menubar.settings')}</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem onClick={onOpenSettings}>
              {t('menubar.openSettings')}
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarRadioGroup value={lang} onValueChange={changeLanguage}>
            {SUPPORTED_LANGUAGES.map((l) => (
              <MenubarRadioItem key={l} value={l}>
                {NATIVE_NAMES[l]}
              </MenubarRadioItem>
            ))}
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
    </div>
  )
}

export default AppMenubar
