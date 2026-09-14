import { Play, Pause } from 'lucide-react';
import { useState } from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName: string;
  senderAvatar: string;
  isGroup: boolean;
}

export default function MessageBubble({ message, isOwn, senderName, senderAvatar, isGroup }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setPlayProgress(0);
    } else {
      setIsPlaying(true);
      const duration = (message.voiceDuration || 10) * 100;
      const interval = setInterval(() => {
        setPlayProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, duration / 100);
    }
  };

  if (message.type === 'voice') {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
        <div className={`flex items-end gap-2 max-w-xs ${isOwn ? 'flex-row-reverse' : ''}`}>
          {isGroup && !isOwn && (
            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">
              {senderAvatar}
            </div>
          )}
          <div>
            {isGroup && !isOwn && (
              <span className="text-xs text-gray-500 mb-1 block">{senderName}</span>
            )}
            <div className={`rounded-2xl px-4 py-3 ${
              isOwn
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-gray-800 text-gray-100 rounded-bl-md'
            }`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isOwn ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-0.5 h-6">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-colors ${
                          i <= (playProgress / 5)
                            ? isOwn ? 'bg-white' : 'bg-blue-400'
                            : isOwn ? 'bg-blue-400/50' : 'bg-gray-600'
                        }`}
                        style={{ height: `${Math.random() * 16 + 6}px` }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs opacity-70">
                      {isPlaying ? formatDuration(Math.floor((playProgress / 100) * (message.voiceDuration || 10))) : '0:00'}
                    </span>
                    <span className="text-xs opacity-70">
                      {formatDuration(message.voiceDuration || 10)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <span className={`text-[10px] text-gray-500 mt-1 block ${isOwn ? 'text-right' : 'text-left'}`}>
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`flex items-end gap-2 max-w-md ${isOwn ? 'flex-row-reverse' : ''}`}>
        {isGroup && !isOwn && (
          <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">
            {senderAvatar}
          </div>
        )}
        <div>
          {isGroup && !isOwn && (
            <span className="text-xs text-gray-500 mb-1 block">{senderName}</span>
          )}
          <div className={`rounded-2xl px-4 py-2.5 ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-800 text-gray-100 rounded-bl-md'
          }`}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
          </div>
          <span className={`text-[10px] text-gray-500 mt-1 block ${isOwn ? 'text-right' : 'text-left'}`}>
            {formatTime(message.timestamp)}
            {isOwn && message.isRead && ' ✓✓'}
          </span>
        </div>
      </div>
    </div>
  );
}
