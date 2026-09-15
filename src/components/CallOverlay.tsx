import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../store/AppContext';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff,
  Users, Maximize2, Minimize2, Volume2, Phone
} from 'lucide-react';

export default function CallOverlay() {
  const { state, dispatch, acceptCall, rejectCall, endCall, toggleMute, toggleCamera, toggleScreenShare, callManager } = useAppContext();
  const { call, chats } = state;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localScreenRef = useRef<HTMLVideoElement>(null);
  const remoteScreenRef = useRef<HTMLVideoElement>(null);

  const activeChat = call.chatId ? chats.find(c => c.id === call.chatId) : null;

  // Setup local video when call starts
  useEffect(() => {
    if (!call.isActive) return;

    const setupLocalStream = () => {
      if (callManager) {
        const webrtc = callManager.getWebRTC();
        if (webrtc) {
          const localStream = webrtc.getLocalStream();
          if (localStream && localVideoRef.current) {
            console.log('[CallOverlay] Setting local video stream');
            localVideoRef.current.srcObject = localStream;
            return true;
          }
        }
      }
      return false;
    };

    if (!setupLocalStream()) {
      console.log('[CallOverlay] Local stream not ready, will retry...');
      const retryInterval = setInterval(() => {
        if (setupLocalStream()) {
          clearInterval(retryInterval);
        }
      }, 100);
      
      setTimeout(() => clearInterval(retryInterval), 5000);
      
      return () => clearInterval(retryInterval);
    }
  }, [call.isActive, callManager]);

  // Handle LOCAL screen share stream (for the sender)
  useEffect(() => {
    if (!call.isActive || !callManager || !call.isScreenSharing) return;

    const setupLocalScreen = () => {
      const webrtc = callManager.getWebRTC();
      if (!webrtc) return false;

      const screenStream = webrtc.getScreenStream();
      if (screenStream && localScreenRef.current) {
        console.log('[CallOverlay] Setting LOCAL screen stream');
        localScreenRef.current.srcObject = screenStream;
        return true;
      }
      return false;
    };

    if (!setupLocalScreen()) {
      console.log('[CallOverlay] Local screen stream not ready, will retry...');
      const retryInterval = setInterval(() => {
        if (setupLocalScreen()) {
          clearInterval(retryInterval);
        }
      }, 100);
      
      const timeout = setTimeout(() => {
        clearInterval(retryInterval);
        console.log('[CallOverlay] Local screen stream setup timeout');
      }, 5000);
      
      return () => {
        clearInterval(retryInterval);
        clearTimeout(timeout);
      };
    }
  }, [call.isActive, callManager, call.isScreenSharing]);

  // Handle remote streams from WebRTC
  useEffect(() => {
    if (!call.isActive || !callManager) return;

    const setupRemoteStream = () => {
      const webrtc = callManager.getWebRTC();
      if (!webrtc) {
        console.log('[CallOverlay] No WebRTC manager');
        return false;
      }

      console.log('[CallOverlay] Checking for remote streams...');

      const remoteStream = webrtc.getRemoteStream();
      if (remoteStream) {
        console.log('[CallOverlay] Remote stream received:', remoteStream);
        console.log('[CallOverlay] Remote stream tracks:', remoteStream.getTracks());
        
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
          console.log('[CallOverlay] Setting remote video stream');
          remoteVideoRef.current.srcObject = remoteStream;
        }
        
        if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remoteStream) {
          console.log('[CallOverlay] Setting remote audio stream');
          remoteAudioRef.current.srcObject = remoteStream;
        }
        
        return true;
      } else {
        console.log('[CallOverlay] No remote stream yet');
        return false;
      }
    };

    if (!setupRemoteStream()) {
      console.log('[CallOverlay] Remote stream not ready, will retry...');
      const retryInterval = setInterval(() => {
        if (setupRemoteStream()) {
          clearInterval(retryInterval);
        }
      }, 100);
      
      const timeout = setTimeout(() => {
        clearInterval(retryInterval);
        console.log('[CallOverlay] Remote stream setup timeout');
      }, 10000);
      
      return () => {
        clearInterval(retryInterval);
        clearTimeout(timeout);
      };
    }
  }, [call.isActive, callManager]);

  // Handle remote screen share stream
  useEffect(() => {
    if (!call.isActive || !callManager) return;

    const setupScreenStream = () => {
      const webrtc = callManager.getWebRTC();
      if (!webrtc) return false;

      const screenStream = webrtc.getRemoteScreenStream();
      if (screenStream && remoteScreenRef.current) {
        console.log('[CallOverlay] Setting remote screen stream');
        remoteScreenRef.current.srcObject = screenStream;
        return true;
      }
      return false;
    };

    if (!setupScreenStream()) {
      const retryInterval = setInterval(() => {
        if (setupScreenStream()) {
          clearInterval(retryInterval);
        }
      }, 100);
      
      const timeout = setTimeout(() => {
        clearInterval(retryInterval);
      }, 10000);
      
      return () => {
        clearInterval(retryInterval);
        clearTimeout(timeout);
      };
    }
  }, [call.isActive, callManager, call.isScreenSharing]);

  const handleEndCall = () => {
    endCall();
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Incoming call UI
  if (call.isActive && call.isIncoming && call.duration === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/95 backdrop-blur-xl">
        <div className="text-center">
          <div className="relative w-32 h-32 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500 to-blue-600 animate-ping opacity-20"></div>
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-green-500 to-blue-600 animate-pulse opacity-40"></div>
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-6xl shadow-2xl shadow-green-500/30">
              {call.callerAvatar || '👤'}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{call.callerName || 'Входящий звонок'}</h2>
          <p className="text-gray-400 mb-8">
            {call.type === 'video' ? '📹 Видеозвонок' : '📞 Голосовой звонок'}
          </p>
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={rejectCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
              title="Отклонить"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <button
              onClick={() => {
                console.log('[CallOverlay] Accept call clicked');
                acceptCall();
              }}
              className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-all shadow-lg shadow-green-500/30"
              title="Принять"
            >
              <Phone className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!call.isActive) return null;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isFullscreen ? '' : 'bg-gray-950/95 backdrop-blur-xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">
            {activeChat?.avatar || '👤'}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{activeChat?.name || 'Звонок'}</h3>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              {formatDuration(call.duration)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {call.type === 'video' && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          )}
          {activeChat?.type === 'group' && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-lg">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">{call.participants.length + 1}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Screen Share - FULL SCREEN when active */}
        {call.isScreenSharing ? (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            {/* Local screen share (for sender) */}
            <video
              ref={localScreenRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            {/* Remote screen share (for receiver) */}
            <video
              ref={remoteScreenRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500/90 rounded-lg text-white text-sm flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Трансляция экрана
            </div>
            
            {/* Local camera in corner */}
            <div className="absolute bottom-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-gray-700 shadow-xl bg-gray-800">
              {call.isCameraOff ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
                    👤
                  </div>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
              )}
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                Вы
              </div>
            </div>
          </div>
        ) : call.type === 'video' ? (
          /* Video Grid - only when NOT screen sharing */
          <div className="grid grid-cols-2 gap-3 p-4 w-full h-full">
            {/* Local Video */}
            <div className="relative rounded-xl overflow-hidden bg-gray-800">
              {call.isCameraOff ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-4xl">
                    👤
                  </div>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
              )}
              <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 rounded-md text-xs text-white">
                Вы {call.isMuted && '(Muted)'}
              </div>
            </div>

            {/* Remote Video */}
            <div className="relative rounded-xl overflow-hidden bg-gray-800">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {call.participants[0] && (
                <>
                  <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 rounded-md text-xs text-white flex items-center gap-1.5">
                    {call.participants[0].name}
                    <div className="flex items-center gap-0.5">
                      <Volume2 className="w-3 h-3 text-green-400" />
                    </div>
                  </div>
                  {/* Speaking indicator */}
                  <div className="absolute top-3 right-3 flex gap-0.5">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-green-500 rounded-full animate-pulse"
                        style={{
                          height: `${8 + Math.random() * 12}px`,
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Voice Call UI */
          <div className="text-center">
            <audio ref={remoteAudioRef} autoPlay />
            
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-6xl mb-6 mx-auto shadow-2xl shadow-blue-500/20 animate-pulse">
              {activeChat?.avatar || '👤'}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{activeChat?.name}</h2>
            <p className="text-gray-400">{formatDuration(call.duration)}</p>
            {activeChat?.type === 'group' && (
              <div className="mt-6 flex justify-center gap-3">
                {call.participants.map((p) => (
                  <div key={p.id} className="flex flex-col items-center gap-1">
                    <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-2xl border-2 border-gray-700">
                      {p.avatar}
                    </div>
                    <span className="text-xs text-gray-400">{p.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-4">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              call.isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
            title={call.isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {call.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Camera (video only) */}
          {call.type === 'video' && (
            <button
              onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                call.isCameraOff
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
              title={call.isCameraOff ? 'Включить камеру' : 'Выключить камеру'}
            >
              {call.isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              call.isScreenSharing
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
            title={call.isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
          >
            {call.isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
            title="Завершить звонок"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
