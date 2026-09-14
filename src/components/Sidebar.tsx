import { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { MessageCircle, Users, Search, Plus, Settings } from 'lucide-react';
import NewChatModal from './NewChatModal';
import SettingsModal from './SettingsModal';

export default function Sidebar() {
  const { state, dispatch } = useAppContext();
  const { chats, activeChatId, sidebarOpen } = state;
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const getLastMessage = (chatId: string) => {
    const messages = state.messages[chatId];
    if (!messages || messages.length === 0) return null;
    return messages[messages.length - 1];
  };

  if (!sidebarOpen) return null;

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-500" />
            GoTalk
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewChat(true)}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors"
              title="Новый чат"
            >
              <Plus className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Поиск чатов..."
            className="w-full bg-gray-800 text-white text-sm rounded-lg pl-10 pr-4 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {/* Private Chats */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider mb-2 px-2">
            <Users className="w-3 h-3" />
            Личные сообщения
          </div>
          {chats.filter(c => c.type === 'private').map(chat => {
            const lastMsg = getLastMessage(chat.id);
            return (
              <div
                key={chat.id}
                onClick={() => {
                  dispatch({ type: 'SET_ACTIVE_CHAT', payload: chat.id });
                  dispatch({ type: 'MARK_AS_READ', payload: chat.id });
                }}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 mb-1 ${
                  activeChatId === chat.id
                    ? 'bg-blue-600/20 border border-blue-500/30'
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
                    {chat.avatar}
                  </div>
                  {chat.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-gray-900"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">{chat.name}</span>
                    {lastMsg && (
                      <span className="text-xs text-gray-500">{formatTime(lastMsg.timestamp)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-gray-400 truncate">
                      {lastMsg?.type === 'voice' ? '🎤 Голосовое сообщение' : lastMsg?.text || 'Нет сообщений'}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span className="ml-2 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-medium px-1.5">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Group Chats */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider mb-2 px-2">
            <Users className="w-3 h-3" />
            Группы
          </div>
          {chats.filter(c => c.type === 'group').map(chat => {
            const lastMsg = getLastMessage(chat.id);
            return (
              <div
                key={chat.id}
                onClick={() => {
                  dispatch({ type: 'SET_ACTIVE_CHAT', payload: chat.id });
                  dispatch({ type: 'MARK_AS_READ', payload: chat.id });
                }}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 mb-1 ${
                  activeChatId === chat.id
                    ? 'bg-blue-600/20 border border-blue-500/30'
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
                    {chat.avatar}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gray-600 border-2 border-gray-900 flex items-center justify-center text-[10px]">
                    {chat.participants.length}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">{chat.name}</span>
                    {lastMsg && (
                      <span className="text-xs text-gray-500">{formatTime(lastMsg.timestamp)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-gray-400 truncate">
                      {lastMsg?.type === 'voice' ? '🎤 Голосовое сообщение' : lastMsg?.text || 'Нет сообщений'}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span className="ml-2 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-medium px-1.5">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* User Profile & Settings */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg">
            {state.currentUser.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{state.currentUser.name}</p>
            <p className="text-xs text-gray-500">В сети</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      <NewChatModal isOpen={showNewChat} onClose={() => setShowNewChat(false)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
