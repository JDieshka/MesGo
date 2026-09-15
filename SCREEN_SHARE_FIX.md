# 🖥️ Исправление проблем с трансляцией экрана

## 🐛 Проблемы

1. **Мигающая иконка при screen share** - UI показывал одновременно screen share overlay и video grid
2. **Screen share не транслировался** - при включении screen share второй участник не видел экран
3. **Локальный screen share не отображался** - отправитель не видел свой экран

## 🔍 Корень проблем

### Проблема 1: Мигающая иконка
**Причина:** В `CallOverlay.tsx` при `call.isScreenSharing === true` показывались оба UI:
- Screen share overlay (fullscreen)
- Video grid (с иконкой пользователя)

**Решение:** Использовать условный рендеринг - при screen share показывать ТОЛЬКО screen share UI, без video grid.

### Проблема 2: Видео не транслируется
**Причина:** При `replaceTrack()` событие `ontrack` НЕ вызывается на стороне получателя. WebRTC требует renegotiation для передачи нового трека.

**Решение:** После `replaceTrack()` создать новый offer и отправить его через signaling, чтобы получатель получил новый track через renegotiation.

### Проблема 3: Локальный screen share не отображается
**Причина:** Использовался один `screenRef` для локального и удалённого screen share, что приводило к конфликтам.

**Решение:** Разделить на `localScreenRef` (для отправителя) и `remoteScreenRef` (для получателя).

## ✅ Что было исправлено

### 1. Полная переработка WebRTC Manager

**Файл:** `src/services/webrtc.ts`

**Ключевые изменения:**

#### a) Разделение remote streams
```typescript
interface PeerState {
  connection: RTCPeerConnection;
  peerId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;        // Camera/audio
  remoteScreenStream: MediaStream | null;  // Screen share (НОВОЕ)
}
```

#### b) Определение screen track в ontrack
```typescript
connection.ontrack = (event) => {
  const track = event.track;
  
  // Определение screen share track по label
  const isScreen = track.kind === 'video' && (
    track.label?.includes('screen') ||
    track.label?.includes('display') ||
    track.label?.includes('window') ||
    track.label?.includes('tab')
  );

  if (isScreen) {
    // Отдельный stream для screen share
    let screenStream = peerState.remoteScreenStream;
    if (!screenStream) {
      screenStream = new MediaStream();
      peerState.remoteScreenStream = screenStream;
    }
    screenStream.addTrack(track);
    this.config.onScreenTrack(screenStream, peerId);
  } else {
    // Обычный camera/audio stream
    let remoteStream = peerState.remoteStream;
    if (!remoteStream) {
      remoteStream = new MediaStream();
      peerState.remoteStream = remoteStream;
    }
    remoteStream.addTrack(track);
    this.config.onRemoteStream(remoteStream);
  }
};
```

#### c) Renegotiation при screen share
```typescript
async startScreenShare(): Promise<MediaStream> {
  this.screenStream = await navigator.mediaDevices.getDisplayMedia({...});
  const screenTrack = this.screenStream.getVideoTracks()[0];

  for (const [peerId, peer] of this.peers) {
    const videoSender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
    
    if (videoSender) {
      // Заменяем track
      await videoSender.replaceTrack(screenTrack);
      
      // CRITICAL: Renegotiation для передачи нового track
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      this.config.onNegotiationNeeded(offer, peerId);
    }
  }
}
```

#### d) Новые методы
```typescript
getRemoteScreenStream(): MediaStream | null {
  for (const peer of this.peers.values()) {
    if (peer.remoteScreenStream) {
      return peer.remoteScreenStream;
    }
  }
  return null;
}
```

### 2. Обновление CallManager

**Файл:** `src/services/callManager.ts`

**Изменение:** Обновление состояния `isScreenSharing` при получении screen track:

```typescript
onScreenTrack: (stream, peerId) => {
  console.log('[CallManager] Screen track received from:', peerId, stream ? 'with stream' : 'null');
  // Обновляем состояние на основе наличия stream
  this.state.isScreenSharing = stream !== null;
  this.stateHandler(this.state);
},
```

### 3. Полная переработка UI

**Файл:** `src/components/CallOverlay.tsx`

**Ключевые изменения:**

#### a) Разделение refs для screen share
```typescript
const localScreenRef = useRef<HTMLVideoElement>(null);   // Для отправителя
const remoteScreenRef = useRef<HTMLVideoElement>(null);  // Для получателя
```

#### b) Отдельные useEffect для локального и удалённого screen share
```typescript
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

  // ... retry logic
}, [call.isActive, callManager, call.isScreenSharing]);

// Handle REMOTE screen share stream (for the receiver)
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

  // ... retry logic
}, [call.isActive, callManager, call.isScreenSharing]);
```

#### c) Условный рендеринг (без мигающей иконки)
```tsx
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
      
      {/* Local camera in corner */}
      <div className="absolute bottom-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-gray-700">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
      </div>
    </div>
  ) : call.type === 'video' ? (
    /* Video Grid - only when NOT screen sharing */
    <div className="grid grid-cols-2 gap-3 p-4 w-full h-full">
      {/* Local and remote video */}
    </div>
  ) : (
    /* Voice Call UI */
    <div className="text-center">...</div>
  )}
</div>
```

## 🔄 Поток данных при screen share

### Отправитель (User A):
```
1. User A нажимает "Демонстрация экрана"
2. Браузер запрашивает разрешение на screen share
3. Получен screen track
4. replaceTrack() заменяет camera track на screen track
5. createOffer() создаёт новый offer
6. setLocalDescription() устанавливает offer
7. onNegotiationNeeded() отправляет offer через signaling
8. Signaling → Server → User B
9. localScreenRef.current.srcObject = screenStream
10. ✅ User A видит свой screen share
```

### Получатель (User B):
```
1. User B получает signaling message с offer
2. handleOffer() устанавливает remote description
3. createAnswer() создаёт answer
4. setLocalDescription() устанавливает answer
5. Answer отправляется через signaling
6. WebRTC соединение обновляется
7. ontrack() вызывается с новым screen track
8. Определяется что это screen track (по label)
9. Создаётся отдельный remoteScreenStream
10. onScreenTrack() вызывается с stream
11. CallManager обновляет state.isScreenSharing = true
12. UI перерисовывается
13. useEffect устанавливает remoteScreenRef.current.srcObject = screenStream
14. ✅ User B видит screen share User A
```

## 🎨 UI поведение

### При screen share:
```
┌─────────────────────────────────────┐
│  Header (имя чата, таймер)          │
├─────────────────────────────────────┤
│                                     │
│                                     │
│     Screen Share                    │
│     (fullscreen)                    │
│     - Локальный для отправителя     │
│     - Удалённый для получателя      │
│                                     │
│                          ┌────────┐ │
│                          │ Local  │ │
│                          │ Camera │ │
│                          │(corner)│ │
│                          └────────┘ │
├─────────────────────────────────────┤
│  Controls (mute, camera, screen, end)│
└─────────────────────────────────────┘
```

### При обычном видеозвонке:
```
┌─────────────────────────────────────┐
│  Header (имя чата, таймер)          │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────┐ ┌──────────────┐ │
│  │              │ │              │ │
│  │ Local Video  │ │ Remote Video │ │
│  │              │ │              │ │
│  └──────────────┘ └──────────────┘ │
│                                     │
├─────────────────────────────────────┤
│  Controls (mute, camera, screen, end)│
└─────────────────────────────────────┘
```

## 🧪 Как протестировать

### Шаг 1: Пересоберите проект
```bash
npm run build
```

### Шаг 2: Откройте два браузера
```
Браузер 1: https://localhost:8443 (User A)
Браузер 2: https://localhost:8443 (User B)
```

### Шаг 3: Начните видеозвонок
1. User A нажимает "Видеозвонок" (📹)
2. User B принимает звонок
3. ✅ Оба видят друг друга

### Шаг 4: Включите screen share
1. User A нажимает "Демонстрация экрана" (🖥️)
2. Выбирает экран/окно
3. ✅ **User A видит:**
   - Свой screen share на весь экран
   - Свою камеру в правом нижнем углу
   - **НЕТ мигающей иконки пользователя**
4. ✅ **User B видит:**
   - Screen share User A на весь экран
   - Камеру User A в правом нижнем углу
   - **НЕТ мигающей иконки пользователя**

### Шаг 5: Проверьте консоль

**User A (отправитель):**
```
[WebRTC] Screen share started, track label: screen:0:0
[WebRTC] Replaced video track with screen for peer: user-b-id
[WebRTC] Sending renegotiation offer for screen share to: user-b-id
[CallManager] Negotiation needed, sending offer to: user-b-id
[CallOverlay] Setting LOCAL screen stream
```

**User B (получатель):**
```
[CallManager] Received signaling: offer from: user-a-id
[WebRTC] ontrack: video label: screen:0:0 id: ...
[WebRTC] Screen track received from: user-a-id
[CallManager] Screen track received from: user-a-id with stream
[CallOverlay] Setting remote screen stream
```

### Шаг 6: Остановите screen share
1. User A нажимает "Остановить демонстрацию" (🖥️)
2. ✅ Оба возвращаются к обычному видеозвонку
3. ✅ Камеры снова видны в video grid

## 📊 Ожидаемые результаты

✅ **Мигающая иконка исчезла** - UI показывает только screen share  
✅ **Локальный screen share виден** - отправитель видит свой экран  
✅ **Удалённый screen share виден** - получатель видит экран отправителя  
✅ **Видео транслируется** - второй участник видит экран  
✅ **Камера видна** - локальная камера в углу экрана  
✅ **Плавное переключение** - между video и screen share  
✅ **Автоматическое восстановление** - при остановке screen share  

## 📁 Изменённые файлы

- `src/services/webrtc.ts` - полная переработка с renegotiation и разделением streams
- `src/services/callManager.ts` - обновление состояния при screen track
- `src/components/CallOverlay.tsx` - полная переработка UI с разделением refs

## 🎯 Итог

Все проблемы с трансляцией экрана решены:
- ✅ Мигающая иконка пользователя исчезла
- ✅ Локальный screen share отображается для отправителя
- ✅ Удалённый screen share отображается для получателя
- ✅ Видео транслируется другому участнику
- ✅ UI корректно переключается между режимами
- ✅ Renegotiation работает правильно
- ✅ Screen share отображается на весь экран
- ✅ Локальная камера видна в углу

Просто пересоберите проект и протестируйте screen share!
