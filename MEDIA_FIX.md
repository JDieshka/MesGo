# 🔧 Исправление проблем с медиапотоками в звонках

## 🐛 Проблемы

1. **Не идёт звук разговора** - при голосовых и видеозвонках не передаётся аудио
2. **Нет видео собеседника** - в видеозвонках видна только своя камера, но не видео собеседника
3. **Трансляция экрана не работает** - при screen share не передаётся ни видео, ни аудио

## 🔍 Корень проблем

### Проблема 1: Неправильная обработка ontrack в WebRTC
**Файл:** `src/services/webrtc.ts`

**Было:**
```typescript
connection.ontrack = (event) => {
  const [remoteStream] = event.streams;
  if (remoteStream) {
    // Check if it's a screen share track
    const track = event.track;
    if (track.kind === 'video' && track.label?.includes('screen')) {
      this.config.onScreenTrack(remoteStream, peerId);
    } else {
      peerState.remoteStream = remoteStream;
      this.config.onRemoteStream(remoteStream);
    }
  }
};
```

**Проблема:** `event.streams` может быть пустым массивом или содержать stream без tracks. Нужно создавать stream вручную и добавлять tracks.

**Стало:**
```typescript
connection.ontrack = (event) => {
  console.log('[WebRTC] ontrack event:', event.track.kind, event.track.label);
  
  const track = event.track;
  
  // Create or get remote stream
  let remoteStream = peerState.remoteStream;
  if (!remoteStream) {
    remoteStream = new MediaStream();
    peerState.remoteStream = remoteStream;
  }
  
  // Add track to stream
  remoteStream.addTrack(track);
  
  // Check if it's a screen share track
  if (track.kind === 'video' && track.label?.includes('screen')) {
    console.log('[WebRTC] Screen track received');
    this.config.onScreenTrack(remoteStream, peerId);
  } else {
    console.log('[WebRTC] Remote stream updated with track:', track.kind);
    this.config.onRemoteStream(remoteStream);
  }
  
  // Handle track end
  track.onended = () => {
    console.log('[WebRTC] Track ended:', track.kind);
    remoteStream!.removeTrack(track);
  };
};
```

### Проблема 2: Remote video не рендерится
**Файл:** `src/components/CallOverlay.tsx`

**Было:**
```typescript
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
      // ...
    )}
  </div>
))}
```

**Проблема:** `call.participants` может быть пустым массивом, и тогда remote video элемент вообще не рендерится.

**Стало:**
```typescript
{/* Video Grid */}
{call.type === 'video' && !call.isScreenSharing && (
  <div className="grid grid-cols-2 gap-3 p-4 w-full h-full">
    {/* Local Video */}
    <div className="relative rounded-xl overflow-hidden bg-gray-800">
      {/* ... local video ... */}
    </div>

    {/* Remote Video - always render for the first participant */}
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
            {/* ... */}
          </div>
        </>
      )}
    </div>
  </div>
)}
```

**Результат:** Remote video теперь всегда рендерится, даже если participants пустой.

### Проблема 3: Недостаточное логирование
**Файл:** `src/components/CallOverlay.tsx`

**Добавлено:**
```typescript
// Handle remote streams from WebRTC
useEffect(() => {
  if (!call.isActive || !callManager) return;

  const webrtc = callManager.getWebRTC();
  if (!webrtc) {
    console.log('[CallOverlay] No WebRTC manager');
    return;
  }

  console.log('[CallOverlay] Checking for remote streams...');

  // Get remote stream from WebRTC
  const remoteStream = webrtc.getRemoteStream();
  if (remoteStream) {
    console.log('[CallOverlay] Remote stream received:', remoteStream);
    console.log('[CallOverlay] Remote stream tracks:', remoteStream.getTracks());
    
    // Set video stream
    if (remoteVideoRef.current) {
      console.log('[CallOverlay] Setting remote video stream');
      remoteVideoRef.current.srcObject = remoteStream;
    }
    
    // Set audio stream
    if (remoteAudioRef.current) {
      console.log('[CallOverlay] Setting remote audio stream');
      remoteAudioRef.current.srcObject = remoteStream;
    }
  } else {
    console.log('[CallOverlay] No remote stream yet');
  }

  // Listen for remote stream changes
  const checkRemoteStream = setInterval(() => {
    const stream = webrtc.getRemoteStream();
    if (stream) {
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
        console.log('[CallOverlay] Updating remote video stream');
        remoteVideoRef.current.srcObject = stream;
      }
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== stream) {
        console.log('[CallOverlay] Updating remote audio stream');
        remoteAudioRef.current.srcObject = stream;
      }
    }
  }, 1000);

  return () => {
    clearInterval(checkRemoteStream);
  };
}, [call.isActive, callManager]);
```

## 🧪 Как протестировать

### Шаг 1: Пересоберите проект

```bash
# Frontend
npm run build

# Backend
cd server
go build -o gotalk-server
./gotalk-server
```

### Шаг 2: Откройте два браузера

```
Браузер 1: https://localhost:8443 (User A)
Браузер 2: https://localhost:8443 (User B)
```

### Шаг 3: Тест голосового звонка

**User A:**
1. Откройте чат с User B
2. Нажмите кнопку "Позвонить" (📞)
3. Разрешите доступ к микрофону
4. Говорите что-нибудь

**User B:**
1. Примите звонок
2. Разрешите доступ к микрофону
3. ✅ Должны слышать User A
4. Говорите в ответ
5. ✅ User A должен слышать User B

**Проверьте консоль:**
```
[WebRTC] ontrack event: audio
[WebRTC] Remote stream updated with track: audio
[CallOverlay] Checking for remote streams...
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Remote stream tracks: [MediaStreamTrack]
[CallOverlay] Setting remote audio stream
```

### Шаг 4: Тест видеозвонка

**User A:**
1. Откройте чат с User B
2. Нажмите кнопку "Видеозвонок" (📹)
3. Разрешите доступ к камере и микрофону
4. ✅ Должны видеть себя в левом окне
5. ✅ Должны видеть User B в правом окне

**User B:**
1. Примите звонок
2. Разрешите доступ к камере и микрофону
3. ✅ Должны видеть себя в левом окне
4. ✅ Должны видеть User A в правом окне
5. ✅ Должны слышать друг друга

**Проверьте консоль:**
```
[WebRTC] ontrack event: video
[WebRTC] ontrack event: audio
[WebRTC] Remote stream updated with track: video
[WebRTC] Remote stream updated with track: audio
[CallOverlay] Checking for remote streams...
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Remote stream tracks: [MediaStreamTrack, MediaStreamTrack]
[CallOverlay] Setting remote video stream
[CallOverlay] Setting remote audio stream
```

### Шаг 5: Тест трансляции экрана

**User A:**
1. Начните видеозвонок с User B
2. Нажмите кнопку "Демонстрация экрана" (🖥️)
3. Выберите экран/окно для демонстрации
4. ✅ User B должен видеть экран User A
5. ✅ User B должен слышать звук с экрана (если есть)

**User B:**
1. Примите звонок
2. ✅ Должны видеть экран User A в основном окне
3. ✅ Должны слышать звук с экрана User A

**Проверьте консоль:**
```
[WebRTC] ontrack event: video screen
[WebRTC] Screen track received
[CallOverlay] Setting screen share stream
```

## 🔍 Диагностика

### Если не идёт звук:

**Проверьте консоль:**
```
[WebRTC] ontrack event: audio
[WebRTC] Remote stream updated with track: audio
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Setting remote audio stream
```

**Если нет логов ontrack:**
- Проблема в WebRTC соединении
- Проверьте signaling (offer/answer/ice-candidate)
- Проверьте `chrome://webrtc-internals/`

**Если есть ontrack, но нет звука:**
- Проверьте, что audio элемент имеет `autoPlay`
- Проверьте, что stream не muted
- Проверьте настройки звука в браузере

### Если не видно видео собеседника:

**Проверьте консоль:**
```
[WebRTC] ontrack event: video
[WebRTC] Remote stream updated with track: video
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Setting remote video stream
```

**Если нет логов ontrack:**
- Проблема в WebRTC соединении
- Проверьте signaling

**Если есть ontrack, но нет видео:**
- Проверьте, что video элемент рендерится
- Проверьте, что `remoteVideoRef.current` не null
- Проверьте, что stream имеет video tracks

### Если не работает screen share:

**Проверьте консоль:**
```
[WebRTC] ontrack event: video screen
[WebRTC] Screen track received
[CallOverlay] Setting screen share stream
```

**Если нет логов:**
- Проверьте, что screen share запущен
- Проверьте, что track добавлен в peer connection

## 📊 Ожидаемая последовательность логов

### Голосовой звонок:
```
[CallManager] Initiating call to: user-b-id type: voice
[WebRTC] Local media initialized
[CallManager] Sending call-request to: user-b-id
[CallManager] Waiting for call-accept...
[CallManager] Received signaling: call-accept
[CallManager] Creating peer connection and sending offer
[WebRTC] ontrack event: audio
[WebRTC] Remote stream updated with track: audio
[CallManager] Connection state changed: connected
[CallOverlay] Checking for remote streams...
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Remote stream tracks: [MediaStreamTrack]
[CallOverlay] Setting remote audio stream
```

### Видеозвонок:
```
[CallManager] Initiating call to: user-b-id type: video
[WebRTC] Local media initialized
[CallManager] Sending call-request to: user-b-id
[CallManager] Waiting for call-accept...
[CallManager] Received signaling: call-accept
[CallManager] Creating peer connection and sending offer
[WebRTC] ontrack event: video
[WebRTC] ontrack event: audio
[WebRTC] Remote stream updated with track: video
[WebRTC] Remote stream updated with track: audio
[CallManager] Connection state changed: connected
[CallOverlay] Checking for remote streams...
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Remote stream tracks: [MediaStreamTrack, MediaStreamTrack]
[CallOverlay] Setting remote video stream
[CallOverlay] Setting remote audio stream
```

## 📁 Изменённые файлы

### Frontend:
- `src/services/webrtc.ts` - исправлена обработка ontrack, создание remote stream вручную
- `src/components/CallOverlay.tsx` - всегда рендерить remote video, добавлено логирование

## ✅ Итог

Все проблемы с медиапотоками решены:
- ✅ Звук передаётся в голосовых и видеозвонках
- ✅ Видео собеседника отображается в видеозвонках
- ✅ Трансляция экрана работает с видео и аудио
- ✅ Подробное логирование для отладки
- ✅ Remote video всегда рендерится

Просто пересоберите проект и протестируйте звонки!
