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
  const screenRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const activeChat = call.chatId ? chats.find(c => c.id === call.chatId) : null;

  // Setup local video when call starts
  useEffect(() => {
    if (!call.isActive) {
      cleanup();
      return;
    }

    // Get local stream from CallManager
    if (callManager) {
      const webrtc = callManager.getWebRTC();
      if (webrtc) {
        const localStream = webrtc.getLocalStream();
        if (localStream && localVideoRef.current) {
          console.log('[CallOverlay] Setting local video stream');
          localVideoRef.current.srcObject = localStream;
        }
      }
    }

    return () => {
      // Don't cleanup on unmount, only on call end
    };
  }, [call.isActive, callManager]);

  // Handle camera toggle
  useEffect(() => {
    if (!call.isActive || !callManager) return;

    const webrtc = callManager.getWebRTC();
    if (!webrtc) return;

    const localStream = webrtc.getLocalStream();
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [call.isCameraOff, callManager]);

  // Handle screen share
  useEffect(() => {
    if (!call.isActive || !callManager) return;

    const webrtc = callManager.getWebRTC();
    if (!webrtc) return;

    // Get screen stream from WebRTC if screen sharing is active
    if (call.isScreenSharing) {
      const screenStream = webrtc.getScreenStream();
      if (screenStream && screenRef.current) {
        console.log('[CallOverlay] Setting screen share stream');
        screenRef.current.srcObject = screenStream;
      }
    }
  }, [call.isScreenSharing, callManager]);

  // Handle remote streams from WebRTC
  useEffect(() => {
    if (!call.isActive || !callManager) return;

    const webrtc = callManager.getWebRTC();
    if (!webrtc) return;

    // Get remote stream from WebRTC
    const remoteStream = webrtc.getRemoteStream();
    if (remoteStream) {
      console.log('[CallOverlay] Remote stream received');
      
      // Set video stream
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      
      // Set audio stream
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }

    // Listen for remote stream changes
    const checkRemoteStream = setInterval(() => {
      const stream = webrtc.getRemoteStream();
      if (stream && remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
        console.log('[CallOverlay] Updating remote stream');
        remoteVideoRef.current.srcObject = stream;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
        }
      }
    }, 1000);

    return () => {
      clearInterval(checkRemoteStream);
    };
  }, [call.isActive, callManager]);

  const cleanup = () => {
    // Cleanup is handled by CallManager
  };

  const handleEndCall = () => {
    cleanup();
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

  // Incoming call UI - only show if call is active, incoming, and not yet connected
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
        {/* Screen Share */}
        {call.isScreenSharing && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <video
              ref={screenRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500/90 rounded-lg text-white text-sm flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Трансляция экрана
            </div>
          </div>
        )}

        {/* Video Grid */}
        {call.type === 'video' && !call.isScreenSharing && (
          <div className={`grid gap-3 p-4 w-full h-full ${
            call.participants.length <= 1
              ? 'grid-cols-1'
              : call.participants.length <= 3
              ? 'grid-cols-2'
              : 'grid-cols-3'
          }`}>
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

            {/* Remote Participants */}
            {call.participants.map((participant, index) => (
              <div key={participant.id} className="relative rounded-xl overflow-hidden bg-gray-800">
                {/* Remote Video */}
                {index === 0 ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-4xl">
                      {participant.avatar}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 rounded-md text-xs text-white flex items-center gap-1.5">
                  {participant.name}
                  <div className="flex items-center gap-0.5">
                    <Volume2 className="w-3 h-3 text-green-400" />
                  </div>
                </div>
                {/* Simulated speaking indicator */}
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
              </div>
            ))}
          </div>
        )}

        {/* Voice Call UI */}
        {call.type === 'voice' && (
          <div className="text-center">
            {/* Remote Audio for voice calls */}
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

        {/* Screen share thumbnail (when in video call) */}
        {call.isScreenSharing && call.type === 'video' && (
          <div className="absolute bottom-24 right-4 w-48 h-32 rounded-xl overflow-hidden border-2 border-gray-700 shadow-xl bg-gray-800">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
              Вы
            </div>
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
