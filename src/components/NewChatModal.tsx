import { useState, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { X, Users, MessageCircle, Search } from 'lucide-react';
import { apiService, User } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewChatModal({ isOpen, onClose }: Props) {
  const { state, dispatch, refreshChats } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await apiService.getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Не удалось загрузить список пользователей');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
         u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setLoading(true);
      setError('');

      let newChatId: string | null = null;

      if (isGroup) {
        // Create group chat
        const result = await apiService.createGroupChat(groupName, selectedUsers);
        newChatId = result.chat.id;
      } else {
        // Create private chat
        const result = await apiService.createPrivateChat(selectedUsers[0]);
        newChatId = result.chat.id;
      }

      // Refresh chats list to show new chat
      await refreshChats();

      // Navigate to the new chat
      if (newChatId) {
        dispatch({ type: 'SET_ACTIVE_CHAT', payload: newChatId });
      }

      // Reset and close modal
      setSelectedUsers([]);
      setGroupName('');
      setSearchQuery('');
      onClose();
    } catch (err: any) {
      console.error('Failed to create chat:', err);
      setError(err.message || 'Не удалось создать чат');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Новый чат</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="flex p-3 gap-2 border-b border-gray-800">
          <button
            onClick={() => { setIsGroup(false); setSelectedUsers([]); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              !isGroup ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Личный
          </button>
          <button
            onClick={() => { setIsGroup(true); setSelectedUsers([]); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              isGroup ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Группа
          </button>
        </div>

        {/* Group Name */}
        {isGroup && (
          <div className="p-3 border-b border-gray-800">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Название группы..."
              className="w-full bg-gray-800 text-white text-sm rounded-lg px-4 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        {/* Search */}
        <div className="p-3 border-b border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск пользователей..."
              className="w-full bg-gray-800 text-white text-sm rounded-lg pl-10 pr-4 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border-b border-gray-800">
            {selectedUsers.map(userId => {
              const user = users.find(u => u.id === userId);
              if (!user) return null;
              return (
                <div
                  key={userId}
                  className="flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full text-xs text-blue-300"
                >
                  <span>{user.avatar}</span>
                  <span>{user.displayName.split(' ')[0]}</span>
                  <button onClick={() => toggleUser(userId)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* User List */}
        <div className="max-h-64 overflow-y-auto p-2">
          {filteredUsers.map(user => (
            <div
              key={user.id}
              onClick={() => toggleUser(user.id)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                selectedUsers.includes(user.id)
                  ? 'bg-blue-600/20 border border-blue-500/30'
                  : 'hover:bg-gray-800'
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">
                  {user.avatar}
                </div>
                {user.status === 'online' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-gray-900"></div>
                )}
              </div>
              <div className="flex-1">
                <span className="text-sm text-white">{user.displayName}</span>
                <p className="text-xs text-gray-500">@{user.username}</p>
              </div>
              {selectedUsers.includes(user.id) && (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <button
            disabled={selectedUsers.length === 0 || (isGroup && !groupName.trim()) || loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-medium transition-colors"
            onClick={handleCreateChat}
          >
            {loading ? 'Создание...' : (isGroup ? 'Создать группу' : 'Начать чат')}
          </button>
        </div>
      </div>
    </div>
  );
}
