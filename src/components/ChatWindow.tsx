import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import {
  Phone, Video, MoreVertical, Send, Mic, MicOff, Paperclip, Smile,
  ChevronLeft
} from 'lucide-react';
import MessageBubble from './MessageBubble';

export default function ChatWindow() {
  const { state, dispatch } = useAppContext();
  const { activeChatId, messages, chats, currentUser, voiceRecording, call } = state;
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const chatMessages = activeChatId ? messages[activeChatId] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!inputText.trim() || !activeChatId) return;
    const newMessage = {
      id: `m${Date.now()}`,
      chatId: activeChatId,
      senderId: currentUser.id,
      text: inputText.trim(),
      timestamp: new Date(),
      type: 'text' as const,
      isRead: false,
    };
    dispatch({ type: 'SEND_MESSAGE', payload: { chatId: activeChatId, message: newMessage } });
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = () => {
    dispatch({ type: 'START_RECORDING' });
    recordingInterval.current = setInterval(() => {
      // Recording timer
    }, 1000);
  };

  const stopRecording = () => {
    dispatch({ type: 'STOP_RECORDING' });
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    if (activeChatId) {
      const newMessage = {
        id: `m${Date.now()}`,
        chatId: activeChatId,
        senderId: currentUser.id,
        text: '🎤 Голосовое сообщение',
        timestamp: new Date(),
        type: 'voice' as const,
        voiceDuration: Math.floor(Math.random() * 30) + 5,
        isRead: false,
      };
      dispatch({ type: 'SEND_MESSAGE', payload: { chatId: activeChatId, message: newMessage } });
    }
  };

  const startCall = (type: 'voice' | 'video') => {
    if (activeChatId) {
      dispatch({ type: 'START_CALL', payload: { chatId: activeChatId, type } });
    }
  };

  const emojis = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '💯', '✨', '🙏', '😊', '😍', '🤔', '😎', '🥳', '💪', '🚀'];

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-xl text-gray-400">Выберите чат</h2>
          <p className="text-sm text-gray-600 mt-2">Выберите чат из списка слева</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-950 h-full">
      {/* Chat Header */}
      <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">
              {activeChat.avatar}
            </div>
            {activeChat.isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-gray-900"></div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{activeChat.name}</h3>
            <p className="text-xs text-gray-400">
              {activeChat.type === 'group'
                ? `${activeChat.participants.length} участников`
                : activeChat.isOnline
                ? 'В сети'
                : 'Не в сети'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => startCall('voice')}
            disabled={call.isActive}
            className="p-2.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-green-400 transition-colors disabled:opacity-50"
            title="Голосовой звонок"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => startCall('video')}
            disabled={call.isActive}
            className="p-2.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
            title="Видеозвонок"
          >
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(147, 51, 234, 0.03) 0%, transparent 50%)',
      }}>
        {/* Date separator */}
        <div className="flex items-center justify-center mb-4">
          <div className="px-3 py-1 bg-gray-800/50 rounded-full text-xs text-gray-500">
            Сегодня
          </div>
        </div>
        {chatMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.senderId === currentUser.id}
            senderName={
              activeChat.participants.find(p => p.id === message.senderId)?.name || 'Неизвестный'
            }
            senderAvatar={
              activeChat.participants.find(p => p.id === message.senderId)?.avatar || '👤'
            }
            isGroup={activeChat.type === 'group'}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-800 p-4 bg-gray-900/30">
        {voiceRecording.isRecording && (
          <div className="mb-3 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-sm text-red-400">Запись голосового сообщения...</span>
            <button
              onClick={stopRecording}
              className="ml-auto px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
            >
              Отправить
            </button>
            <button
              onClick={() => dispatch({ type: 'STOP_RECORDING' })}
              className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors"
            >
              Отмена
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button className="p-2.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите сообщение..."
              rows={1}
              className="w-full bg-gray-800 text-white text-sm rounded-xl px-4 py-3 border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            {showEmoji && (
              <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl">
                <div className="grid grid-cols-8 gap-1">
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setInputText(prev => prev + emoji);
                        setShowEmoji(false);
                      }}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>
          {inputText.trim() ? (
            <button
              onClick={handleSend}
              className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={voiceRecording.isRecording ? stopRecording : startRecording}
              className={`p-2.5 rounded-lg transition-colors ${
                voiceRecording.isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'hover:bg-gray-800 text-gray-400'
              }`}
            >
              {voiceRecording.isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
