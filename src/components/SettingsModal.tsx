import { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { X, User, Bell, Lock, Palette, Globe, LogOut } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: Props) {
  const { state } = useAppContext();
  const [activeTab, setActiveTab] = useState('profile');

  if (!isOpen) return null;

  const tabs = [
    { id: 'profile', label: 'Профиль', icon: User },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    { id: 'privacy', label: 'Приватность', icon: Lock },
    { id: 'appearance', label: 'Внешний вид', icon: Palette },
    { id: 'language', label: 'Язык', icon: Globe },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden max-h-[80vh] flex">
        {/* Sidebar */}
        <div className="w-56 border-r border-gray-800 p-3 flex flex-col">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-lg font-semibold text-white">Настройки</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex-1 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors mt-4">
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl shadow-lg">
                  {state.currentUser.avatar}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{state.currentUser.name}</h3>
                  <p className="text-sm text-gray-400">ID: {state.currentUser.id}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-400">В сети</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Имя</label>
                  <input
                    type="text"
                    defaultValue={state.currentUser.name}
                    className="w-full bg-gray-800 text-white text-sm rounded-lg px-4 py-2.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Статус</label>
                  <select className="w-full bg-gray-800 text-white text-sm rounded-lg px-4 py-2.5 border border-gray-700 focus:border-blue-500 focus:outline-none">
                    <option value="online">В сети</option>
                    <option value="away">Отошёл</option>
                    <option value="busy">Не беспокоить</option>
                    <option value="offline">Невидимка</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">О себе</label>
                  <textarea
                    placeholder="Расскажите о себе..."
                    rows={3}
                    className="w-full bg-gray-800 text-white text-sm rounded-lg px-4 py-2.5 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
              <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                Сохранить
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Уведомления</h3>
              {[
                { label: 'Звук сообщений', desc: 'Воспроизводить звук при новых сообщениях' },
                { label: 'Уведомления о звонках', desc: 'Показывать уведомления о входящих звонках' },
                { label: 'Предпросмотр', desc: 'Показывать текст сообщения в уведомлениях' },
                { label: 'Звук звонка', desc: 'Воспроизводить мелодию при входящем звонке' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                  <div>
                    <p className="text-sm text-white">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={i < 3} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Приватность</h3>
              {[
                { label: 'Двухфакторная аутентификация', desc: 'Дополнительная защита аккаунта' },
                { label: 'Скрыть время последнего визита', desc: 'Другие не увидят когда вы были в сети' },
                { label: 'Шифрование сообщений', desc: 'End-to-end шифрование всех сообщений' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                  <div>
                    <p className="text-sm text-white">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={i === 2} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Внешний вид</h3>
              <div className="p-3 bg-gray-800/50 rounded-xl">
                <p className="text-sm text-white mb-3">Тема</p>
                <div className="flex gap-3">
                  <button className="flex-1 py-3 bg-gray-900 border-2 border-blue-500 rounded-xl text-sm text-white">
                    🌙 Тёмная
                  </button>
                  <button className="flex-1 py-3 bg-gray-700 border-2 border-transparent rounded-xl text-sm text-gray-400 hover:border-gray-600">
                    ☀️ Светлая
                  </button>
                  <button className="flex-1 py-3 bg-gray-700 border-2 border-transparent rounded-xl text-sm text-gray-400 hover:border-gray-600">
                    💻 Системная
                  </button>
                </div>
              </div>
              <div className="p-3 bg-gray-800/50 rounded-xl">
                <p className="text-sm text-white mb-3">Цвет акцента</p>
                <div className="flex gap-2">
                  {['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500'].map((color, i) => (
                    <button
                      key={i}
                      className={`w-8 h-8 rounded-full ${color} ${i === 0 ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''}`}
                    />
                  ))}
                </div>
              </div>
              <div className="p-3 bg-gray-800/50 rounded-xl">
                <p className="text-sm text-white mb-2">Размер шрифта</p>
                <input
                  type="range"
                  min="12"
                  max="20"
                  defaultValue="14"
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'language' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Язык</h3>
              {[
                { flag: '🇷🇺', name: 'Русский', selected: true },
                { flag: '🇺🇸', name: 'English', selected: false },
                { flag: '🇩🇪', name: 'Deutsch', selected: false },
                { flag: '🇫🇷', name: 'Français', selected: false },
                { flag: '🇪🇸', name: 'Español', selected: false },
                { flag: '🇨🇳', name: '中文', selected: false },
              ].map((lang, i) => (
                <button
                  key={i}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    lang.selected
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'bg-gray-800/50 hover:bg-gray-800'
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className={`text-sm ${lang.selected ? 'text-blue-400' : 'text-white'}`}>{lang.name}</span>
                  {lang.selected && (
                    <svg className="w-4 h-4 text-blue-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
