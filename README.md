# GoTalk — Мессенджер

Полнофункциональное веб-приложение для обмена сообщениями с поддержкой голосовых/видео звонков и трансляции экрана.

## 🏗️ Архитектура

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** для стилей
- **Vite** для сборки
- **Lucide React** для иконок
- **WebSocket** для real-time сообщений
- **WebRTC** для звонков
- **MediaRecorder API** для голосовых сообщений

### Backend
- **Go** (Golang)
- **Gorilla WebSocket** для real-time сообщений
- **Gorilla Mux** для HTTP роутинга
- **WebRTC Signaling** для звонков

## ✅ Реализованный функционал

### 💬 Чат
- ✅ Личные сообщения
- ✅ Групповые чаты
- ✅ Голосовые сообщения (реальная запись через MediaRecorder)
- ✅ Воспроизведение голосовых с waveform визуализацией
- ✅ Индикатор подключения WebSocket
- ✅ Статусы онлайн/оффлайн
- ✅ Счётчик непрочитанных сообщений
- ✅ Эмодзи-панель
- ✅ Создание новых чатов и групп

### 📞 Звонки
- ✅ Голосовые звонки (личные)
- ✅ Видеозвонки (личные)
- ✅ Групповые звонки (UI готов)
- ✅ Управление микрофоном и камерой
- ✅ Входящие звонки (UI)
- ✅ Реальная камера через `getUserMedia()`

### 🖥️ Трансляция экрана
- ✅ Демонстрация экрана через `getDisplayMedia()`
- ✅ Переключение между камерой и экраном
- ✅ Picture-in-picture для камеры при демонстрации

### 🎨 Интерфейс
- ✅ Тёмная тема
- ✅ Адаптивный дизайн
- ✅ Модалка настроек (5 вкладок)
- ✅ Модалка создания чата
- ✅ Анимации и transitions

### 🔌 Real-time
- ✅ WebSocket клиент с auto-reconnect
- ✅ Heartbeat для поддержания соединения
- ✅ Индикатор статуса подключения
- ✅ Отправка/получение сообщений через WS
- ✅ Signaling для WebRTC

## 🚀 Запуск

### Frontend (разработка)
```bash
npm install
npm run dev
```

### Frontend (сборка)
```bash
npm run build
```

### Backend (Go)
```bash
cd server
go mod tidy
go run main.go webrtc.go
```

Сервер запустится на порту 8080.

## 📡 API Endpoints

### WebSocket
- `ws://localhost:8080/ws/{userId}` — подключение к WebSocket

### REST API
- `GET /health` — проверка здоровья сервера
- `GET /api/messages/{chatId}` — получение сообщений чата

### WebSocket Messages

#### Отправка текстового сообщения
```json
{
  "type": "chat-message",
  "payload": {
    "chatId": "chat1",
    "message": {
      "text": "Hello!",
      "type": "text"
    }
  }
}
```

#### Отправка голосового сообщения
```json
{
  "type": "chat-message",
  "payload": {
    "chatId": "chat1",
    "message": {
      "text": "🎤 Голосовое сообщение",
      "type": "voice",
      "voiceDuration": 5,
      "audioData": "base64-encoded-audio...",
      "waveform": [0.5, 0.8, 0.3, ...]
    }
  }
}
```

#### WebRTC Signaling
```json
{
  "type": "signaling",
  "payload": {
    "type": "offer",
    "from": "user1",
    "to": "user2",
    "chatId": "chat1",
    "callType": "video",
    "data": { "sdp": "..." }
  }
}
```

## 📝 Структура проекта

```
├── src/
│   ├── App.tsx                    # Главный компонент
│   ├── index.css                  # Глобальные стили
│   ├── main.tsx                   # Точка входа
│   ├── types/
│   │   └── index.ts               # TypeScript типы
│   ├── store/
│   │   └── AppContext.tsx          # State management + WS интеграция
│   ├── services/
│   │   ├── websocket.ts           # WebSocket клиент
│   │   ├── audioRecorder.ts       # Запись голосовых сообщений
│   │   ├── webrtc.ts              # WebRTC менеджер
│   │   └── callManager.ts         # Оркестратор звонков
│   └── components/
│       ├── Sidebar.tsx            # Боковая панель с чатами
│       ├── ChatWindow.tsx         # Окно чата
│       ├── MessageBubble.tsx      # Компонент сообщения
│       ├── CallOverlay.tsx        # Интерфейс звонка
│       ├── NewChatModal.tsx       # Модалка создания чата
│       └── SettingsModal.tsx      # Настройки
├── server/
│   ├── main.go                    # Основной сервер + WebSocket
│   ├── webrtc.go                  # WebRTC signaling
│   └── go.mod                     # Go модули
└── index.html
```

## 🔧 Технические детали

### WebSocket
- Автоматический reconnect при обрыве связи
- Heartbeat каждые 30 секунд
- Экспоненциальная задержка при reconnect
- Обработка событий: `chat-message`, `typing`, `user-status`, `signaling`

### Голосовые сообщения
- Запись через `MediaRecorder API`
- Формат: WebM/Opus (или OGG/Opus)
- Визуализация waveform в реальном времени
- Хранение в base64 для передачи через WebSocket
- Воспроизведение через `HTMLAudioElement`

### WebRTC
- Публичные STUN серверы (Google)
- Поддержка voice и video
- Screen sharing через `getDisplayMedia()`
- Signaling через WebSocket
- Управление tracks (mute/camera/screen)

## 🚧 Что ещё можно добавить

### Критично
- [ ] Полная интеграция WebRTC P2P (реальные звонки между клиентами)
- [ ] Аутентификация (JWT)
- [ ] База данных (PostgreSQL)

### Важно
- [ ] TURN сервер для работы за NAT
- [ ] Загрузка файлов/изображений
- [ ] Редактирование и удаление сообщений
- [ ] Push-уведомления

### Желательно
- [ ] End-to-end шифрование
- [ ] Полнотекстовый поиск
- [ ] Реакции на сообщения
- [ ] Docker-контейнеризация
- [ ] CI/CD

## 📄 Лицензия

MIT
