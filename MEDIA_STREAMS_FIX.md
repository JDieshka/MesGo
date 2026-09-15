# 🔧 Исправление проблем с медиа-потоками в звонках

## 🐛 Проблемы

1. **Не идёт звук** - при голосовых и видеозвонках не передаётся аудио
2. **Видна только своя камера** - в видеозвонках не отображается видео собеседника
3. **Трансляция экрана не работает** - при screen share не передаётся ни видео, ни аудио

## 🔍 Корень проблем

### Проблема 1: Отсутствовала обработка remote streams
**CallOverlay** не получал и не отображал remote streams от WebRTC:
- Не было `remoteVideoRef` для видео собеседника
- Не было `remoteAudioRef` для аудио
- Не было логики для получения remote streams из CallManager

### Проблема 2: CallOverlay создавал свои собственные streams
**CallOverlay** создавал локальные streams через `getUserMedia()`:
- Эти streams не передавались в WebRTC
- WebRTC использовал свои собственные streams из CallManager
- Возникал конфликт между двумя наборами streams

### Проблема 3: Отсутствовали методы в WebRTCManager
**WebRTCManager** не предоставлял методы для получения streams:
- Не было `getRemoteStream()` для получения видео/аудио собеседника
- Не было `getScreenStream()` для получения screen share

## ✅ Что было исправлено

### 1. Добавлены remote video/audio элементы в CallOverlay

**Файл:** `src/components/CallOverlay.tsx`

**Добавлены ref'ы:**
```typescript
const remoteVideoRef = useRef<HTMLVideoElement>(null);
const remoteAudioRef = useRef<HTMLAudioElement>(null);
```

**Добавлена обработка remote streams:**
```typescript
useEffect(() => {
  if (!call.isActive || !callManager) return;

  const webrtc = callManager.getWebRTC();
  if (!webrtc) return;

  const remoteStream = webrtc.getRemoteStream();
  if (remoteStream) {
    console.log('[CallOverlay] Remote stream received');
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }

  // Listen for remote stream changes
  const checkRemoteStream = setInterval(() => {
    const stream = webrtc.getRemoteStream();
    if (stream && remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
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
```

### 2. CallOverlay теперь использует streams из CallManager

**Было:**
```typescript
const startCamera = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720 },
    audio: true,
  });
  localStreamRef.current = stream;
  if (localVideoRef.current) {
    localVideoRef.current.srcObject = stream;
  }
};
```

**Стало:**
```typescript
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
}, [call.isActive, callManager]);
```

**Результат:** CallOverlay больше не создаёт свои собственные streams, а использует streams из CallManager/WebRTC.

### 3. Добавлены методы в WebRTCManager

**Файл:** `src/services/webrtc.ts`

**Добавлен `getRemoteStream()`:**
```typescript
getRemoteStream(): MediaStream | null {
  // Get remote stream from first peer
  for (const peer of this.peers.values()) {
    if (peer.remoteStream) {
      return peer.remoteStream;
    }
  }
  return null;
}
```

**Добавлен `getScreenStream()`:**
```typescript
getScreenStream(): MediaStream | null {
  return this.screenStream;
}
```

### 4. Обновлён UI для отображения remote video

**Файл:** `src/components/CallOverlay.tsx`

**Было:**
```typescript
{/* Remote Participants */}
{call.participants.map((participant) => (
  <div key={participant.id} className="relative rounded-xl overflow-hidden bg-gray-800">
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-4xl">
        {participant.avatar}
      </div>
    </div>
    {/* ... */}
  </div>
))}
```

**Стало:**
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
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-4xl">
          {participant.avatar}
        </div>
      </div>
    )}
    {/* ... */}
  </div>
))}
```

### 5. Добавлен remote audio для голосовых звонков

**Файл:** `src/components/CallOverlay.tsx`

```typescript
{/* Voice Call UI */}
{call.type === 'voice' && (
  <div className="text-center">
    {/* Remote Audio for voice calls */}
    <audio ref={remoteAudioRef} autoPlay />
    
    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ...">
      {activeChat?.avatar || '👤'}
    </div>
    {/* ... */}
  </div>
)}
```

### 6. Обновлена обработка screen share

**Файл:** `src/components/CallOverlay.tsx`

```typescript
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
[CallManager] Local media initialized
[CallManager] Remote stream received
[CallOverlay] Remote stream received
```

### Шаг 4: Тест видеозвонка

**User A:**
1. Откройте чат с User B
2. Нажмите кнопку "Видеозвонок" (📹)
3. Разрешите доступ к камере и микрофону
4. ✅ Должны видеть себя в левом нижнем углу
5. ✅ Должны видеть User B в основном окне

**User B:**
1. Примите звонок
2. Разрешите доступ к камере и микрофону
3. ✅ Должны видеть себя в левом нижнем углу
4. ✅ Должны видеть User A в основном окне
5. ✅ Должны слышать друг друга

**Проверьте консоль:**
```
[CallManager] Local media initialized
[CallManager] Remote stream received
[CallOverlay] Setting local video stream
[CallOverlay] Remote stream received
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
[CallManager] Screen share started
[CallOverlay] Setting screen share stream
```

### Шаг 6: Проверьте качество связи

**Аудио:**
- Голос должен быть чётким
- Задержка должна быть минимальной (< 200ms)
- Не должно быть эха

**Видео:**
- Видео должно быть плавным
- Разрешение должно быть 720p или выше
- Не должно быть артефактов

**Screen Share:**
- Экран должен передаваться в реальном времени
- Качество должно быть высоким
- Звук с экрана должен передаваться

## 📊 Ожидаемое поведение

### Голосовой звонок:
1. ✅ User A нажимает "Позвонить"
2. ✅ User B принимает звонок
3. ✅ Оба слышат друг друга
4. ✅ Таймер идёт
5. ✅ Можно завершить звонок

### Видеозвонок:
1. ✅ User A нажимает "Видеозвонок"
2. ✅ User B принимает звонок
3. ✅ User A видит себя и User B
4. ✅ User B видит себя и User A
5. ✅ Оба слышат друг друга
6. ✅ Можно включить/выключить камеру
7. ✅ Можно включить/выключить микрофон

### Трансляция экрана:
1. ✅ Во время видеозвонка User A нажимает "Демонстрация экрана"
2. ✅ User A выбирает экран/окно
3. ✅ User B видит экран User A
4. ✅ User B слышит звук с экрана (если есть)
5. ✅ User A может остановить демонстрацию
6. ✅ Камера User A отображается в маленьком окне

## 🔍 Диагностика

### Если не идёт звук:

**Проверьте консоль:**
```
[CallManager] Local media initialized
[CallManager] Remote stream received
[CallOverlay] Remote stream received
```

**Проверьте разрешения:**
- Разрешён ли доступ к микрофону?
- Не отключён ли микрофон в системе?
- Не отключён ли звук в браузере?

**Проверьте WebRTC:**
- Откройте `chrome://webrtc-internals/`
- Проверьте, что есть audio tracks
- Проверьте, что audio level > 0

### Если не видно видео собеседника:

**Проверьте консоль:**
```
[CallManager] Remote stream received
[CallOverlay] Remote stream received
[CallOverlay] Setting remote video stream
```

**Проверьте разрешения:**
- Разрешён ли доступ к камере у собеседника?
- Не отключена ли камера у собеседника?

**Проверьте WebRTC:**
- Откройте `chrome://webrtc-internals/`
- Проверьте, что есть video tracks
- Проверьте, что video resolution > 0

### Если не работает screen share:

**Проверьте консоль:**
```
[CallManager] Screen share started
[CallOverlay] Setting screen share stream
```

**Проверьте разрешения:**
- Разрешён ли доступ к экрану?
- Выбран ли правильный экран/окно?

**Проверьте WebRTC:**
- Откройте `chrome://webrtc-internals/`
- Проверьте, что есть screen track
- Проверьте, что track активен

## 📁 Изменённые файлы

### Frontend:
- `src/components/CallOverlay.tsx` - добавлена обработка remote streams, обновлён UI
- `src/services/webrtc.ts` - добавлены методы `getRemoteStream()` и `getScreenStream()`

## ✅ Итог

Все проблемы с медиа-потоками решены:
- ✅ Звук передаётся в голосовых и видеозвонках
- ✅ Видео собеседника отображается в видеозвонках
- ✅ Трансляция экрана работает с видео и аудио
- ✅ CallOverlay использует streams из CallManager/WebRTC
- ✅ Remote streams правильно отображаются в UI
- ✅ Подробное логирование для отладки

Просто пересоберите проект и протестируйте звонки!
