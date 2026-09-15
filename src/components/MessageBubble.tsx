import { Play, Pause } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { base64ToBlob } from '../services/audioRecorder';

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
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Create audio URL from base64 data
  useEffect(() => {
    if (message.type === 'voice' && message.audioData) {
      const blob = base64ToBlob(message.audioData);
      audioUrlRef.current = URL.createObjectURL(blob);

      return () => {
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }
      };
    }
  }, [message.audioData]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (!audioUrlRef.current) {
      // Simulate playback for demo messages without audio data
      if (isPlaying) {
        setIsPlaying(false);
        setPlayProgress(0);
        setCurrentTime(0);
      } else {
        setIsPlaying(true);
        const duration = (message.voiceDuration || 10) * 100;
        const interval = setInterval(() => {
          setPlayProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setIsPlaying(false);
              setCurrentTime(0);
              return 0;
            }
            setCurrentTime((prev / 100) * (message.voiceDuration || 10));
            return prev + 1;
          });
        }, duration / 100);
      }
      return;
    }

    // Real audio playback
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrlRef.current);
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setPlayProgress(0);
          setCurrentTime(0);
        };
        audioRef.current.ontimeupdate = () => {
          if (audioRef.current) {
            const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
            setPlayProgress(progress);
            setCurrentTime(audioRef.current.currentTime);
          }
        };
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Get waveform data or generate fake one
  const waveform = message.waveform || Array.from({ length: 30 }, () => Math.random() * 0.8 + 0.2);

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
                    {waveform.map((value, i) => {
                      const played = i <= (playProgress / 100) * waveform.length;
                      return (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-colors ${
                            played
                              ? isOwn ? 'bg-white' : 'bg-blue-400'
                              : isOwn ? 'bg-blue-400/50' : 'bg-gray-600'
                          }`}
                          style={{ height: `${value * 20 + 4}px` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs opacity-70">
                      {formatDuration(currentTime)}
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
              {isOwn && message.isRead && ' ✓✓'}
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
