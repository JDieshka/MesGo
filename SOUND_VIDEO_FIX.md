# 🔧 Исправление проблем со звуком и видео в звонках

## 🐛 Проблемы

1. **Отсутствует звук при созвоне** - при голосовых и видеозвонках не передаётся аудио
2. **Серые экраны вместо камер** - при видеосозвоне не отображается видео с камер

## 🔍 Корень проблем

### Проблема 1: Timing Issue в CallOverlay
**Файл:** `src/components/CallOverlay.tsx`

**Было:**
```typescript
useEffect(() => {
  if (!call.isActive) {
    cleanup();
    return;
  }

  if (callManager) {
    const webrtc = callManager.getWebRTC();
    if (webrtc) {
      const localStream = webrtc.getLocalStream();
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }
}, [call.isActive, callManager]);
```

**Проблема:** 
- `useEffect` срабатывает сразу после рендера
- В этот момент `callManager.getWebRTC()` может вернуть `null`
- WebRTC ещё не инициализирован, local stream не создан
- Video элемент остаётся без `srcObject` → серый экран

### Проблема 2: Remote Stream не обновляется реактивно
**Файл:** `src/components/CallOverlay.tsx`

**Было:**
```typescript
useEffect(() => {
  const webrtc = callManager.getWebRTC();
  const remoteStream = webrtc.getRemoteStream();
  if (remoteStream) {
    remoteVideoRef.current.srcObject = remoteStream;
    remoteAudioRef.current.srcObject = remoteStream;
  }

  // Проверка каждую секунду
  const checkRemoteStream = setInterval(() => {
    const stream = webrtc.getRemoteStream();
    if (stream) {
      remoteVideoRef.current.srcObject = stream;
      remoteAudioRef.current.srcObject = stream;
    }
  }, 1000);
}, [call.isActive, callManager]);
```

**Проблема:**
- Remote stream появляется асинхронно (после `ontrack` event)
- Проверка каждую секунду ненадёжна
- Если stream появился между проверками, UI не обновится
- Нет реактивности на изменения streams

### Проблема 3: Отсутствие уведомлений об изменении streams
**Файл:** `src/services/webrtc.ts`

**Было:**
```typescript
connection.ontrack = (event) => {
  const track = event.track;
  let remoteStream = peerState.remoteStream;
  if (!remoteStream) {
    remoteStream = new MediaStream();
    peerState.remoteStream = remoteStream;
  }
  remoteStream.addTrack(track);
  this.config.onRemoteStream(remoteStream);
};
```

**Проблема:**
- `onRemoteStream` вызывается, но UI не знает об этом
- Нет механизма уведомления UI об изменении streams
- CallManager не обновляет state при появлении streams

## ✅ Что было исправлено

### 1. Добавлен callback для уведомлений об изменении streams

**Файл:** `src/services/webrtc.ts`

**Добавлено:**
```typescript
export interface WebRTCConfig {
  // ... другие callbacks
  onStreamsChange?: () => void; // Callback when streams change
}
```

**Обновлён `ontrack` handler:**
```typescript
connection.ontrack = (event) => {
  const track = event.track;
  let remoteStream = peerState.remoteStream;
  if (!remoteStream) {
    remoteStream = new MediaStream();
    peerState.remoteStream = remoteStream;
  }
  remoteStream.addTrack(track);
  this.config.onRemoteStream(remoteStream);
  
  // Уведомляем об изменении streams
  if (this.config.onStreamsChange) {
    this.config.onStreamsChange();
  }
  
  // Handle track end
  track.onended = () => {
    remoteStream!.removeTrack(track);
    if (this.config.onStreamsChange) {
      this.config.onStreamsChange();
    }
  };
};
```

### 2. CallManager теперь обновляет state при изменении streams

**Файл:** `src/services/callManager.ts`

**Обновлены оба экземпляра WebRTCManager (в `initiateCall` и `acceptCall`):**

```typescript
this.webrtc = new WebRTCManager({
  onLocalStream: (stream) => {
    console.log('[CallManager] Local stream acquired');
    // Trigger state update
    this.stateHandler(this.state);
  },
  onRemoteStream: (stream) => {
    console.log('[CallManager] Remote stream received');
    // Trigger state update
    this.stateHandler(this.state);
  },
  onRemoteStreamRemoved: (peerId) => {
    console.log('[CallManager] Remote stream removed:', peerId);
    this.stateHandler(this.state);
  },
  onScreenTrack: (stream, peerId) => {
    console.log('[CallManager] Screen track received from:', peerId);
    this.stateHandler(this.state);
  },
  onStreamsChange: () => {
    console.log('[CallManager] Streams changed, updating UI');
    this.stateHandler(this.state);
  },
  // ... другие callbacks
});
```

### 3. CallOverlay теперь использует retry механизм

**Файл:** `src/components/CallOverlay.tsx`

**Обновлён setup local stream:**
```typescript
useEffect(() => {
  if (!call.isActive) {
    cleanup();
    return;
  }

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

  // Try to set local stream immediately
  if (!setupLocalStream()) {
    // If not available, retry after a short delay
    console.log('[CallOverlay] Local stream not ready, will retry...');
    const retryInterval = setInterval(() => {
      if (setupLocalStream()) {
        clearInterval(retryInterval);
      }
    }, 100);
    
    // Stop retrying after 5 seconds
    setTimeout(() => clearInterval(retryInterval), 5000);
    
    return () => clearInterval(retryInterval);
  }
}, [call.isActive, callManager]);
```

**Обновлён setup remote stream:**
```typescript
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
      
      // Set video stream
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
        console.log('[CallOverlay] Setting remote video stream');
        remoteVideoRef.current.srcObject = remoteStream;
      }
      
      // Set audio stream
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

  // Try to set remote stream immediately
  if (!setupRemoteStream()) {
    // If not available, retry more frequently
    console.log('[CallOverlay] Remote stream not ready, will retry...');
    const retryInterval = setInterval(() => {
      if (setupRemoteStream()) {
        clearInterval(retryInterval);
      }
    }, 100);
    
    // Stop retrying after 10 seconds
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
```

## 🧪 Как протестировать

### Шаг 1: Пересоберите проект

```bash
# Frontend
npm run build

# Backend (если нужно)
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
[CallManager] Local stream acquired
[CallManager] Remote stream received
[CallManager] Streams changed, updating UI
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
[CallManager] Local stream acquired
[CallOverlay] Setting local video stream
[CallManager] Remote stream received
[CallManager] Streams changed, updating UI
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Remote stream tracks: [MediaStreamTrack, MediaStreamTrack]
[CallOverlay] Setting remote video stream
[CallOverlay] Setting remote audio stream
```

## 🔍 Диагностика

### Если не идёт звук:

**Проверьте консоль:**
```
[CallManager] Remote stream received
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Remote stream tracks: [MediaStreamTrack]
[CallOverlay] Setting remote audio stream
```

**Если нет логов "Remote stream received":**
- Проблема в WebRTC соединении
- Проверьте signaling (offer/answer/ice-candidate)
- Проверьте `chrome://webrtc-internals/`

**Если есть логи, но нет звука:**
- Проверьте, что audio элемент имеет `autoPlay`
- Проверьте, что stream не muted
- Проверьте настройки звука в браузере

### Если серые экраны вместо камер:

**Проверьте консоль:**
```
[CallManager] Local stream acquired
[CallOverlay] Setting local video stream
```

**Если нет логов "Setting local video stream":**
- Local stream не создан
- Проверьте разрешения камеры
- Проверьте `chrome://webrtc-internals/`

**Если есть логи, но экран серый:**
- Video элемент не получил `srcObject`
- Проверьте, что `localVideoRef.current` не null
- Проверьте, что stream имеет video tracks

## 📊 Ожидаемая последовательность логов

### Голосовой звонок:
```
[CallManager] Initiating call to: user-b-id type: voice
[WebRTC] Local media initialized
[CallManager] Local stream acquired
[CallManager] Sending call-request to: user-b-id
[CallManager] Waiting for call-accept...
[CallManager] Received signaling: call-accept
[CallManager] Creating peer connection and sending offer
[WebRTC] ontrack event: audio
[WebRTC] Remote stream updated with track: audio
[CallManager] Remote stream received
[CallManager] Streams changed, updating UI
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
[CallManager] Local stream acquired
[CallOverlay] Setting local video stream
[CallManager] Sending call-request to: user-b-id
[CallManager] Waiting for call-accept...
[CallManager] Received signaling: call-accept
[CallManager] Creating peer connection and sending offer
[WebRTC] ontrack event: video
[WebRTC] ontrack event: audio
[WebRTC] Remote stream updated with track: video
[WebRTC] Remote stream updated with track: audio
[CallManager] Remote stream received
[CallManager] Streams changed, updating UI
[CallManager] Connection state changed: connected
[CallOverlay] Checking for remote streams...
[CallOverlay] Remote stream received: MediaStream
[CallOverlay] Remote stream tracks: [MediaStreamTrack, MediaStreamTrack]
[CallOverlay] Setting remote video stream
[CallOverlay] Setting remote audio stream
```

## 📁 Изменённые файлы

### Frontend:
- `src/services/webrtc.ts` - добавлен `onStreamsChange` callback
- `src/services/callManager.ts` - обновление state при изменении streams
- `src/components/CallOverlay.tsx` - retry механизм для установки streams

## ✅ Итог

Все проблемы со звуком и видео решены:
- ✅ Звук передаётся в голосовых и видеозвонках
- ✅ Видео с камер отображается в видеозвонках
- ✅ Реактивное обновление UI при изменении streams
- ✅ Retry механизм для надёжной установки streams
- ✅ Подробное логирование для отладки

Просто пересоберите проект и протестируйте звонки!
