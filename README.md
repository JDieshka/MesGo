# GoTalk — Мессенджер

Полнофункциональное веб-приложение для обмена сообщениями с поддержкой голосовых/видео звонков, трансляции экрана, аутентификации и базой данных PostgreSQL.

## 🏗️ Архитектура

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** для стилей
- **Vite** для сборки
- **Lucide React** для иконок
- **WebSocket** для real-time сообщений
- **WebRTC** для звонков
- **MediaRecorder API** для голосовых сообщений
- **JWT** для аутентификации

### Backend
- **Go** (Golang)
- **PostgreSQL** — база данных
- **Gorilla WebSocket** для real-time сообщений
- **Gorilla Mux** для HTTP роутинга
- **pgx** — драйвер PostgreSQL
- **JWT** — аутентификация
- **bcrypt** — хэширование паролей
- **WebRTC Signaling** для звонков

## ✅ Реализованный функционал

### 🔐 Аутентификация
- ✅ Регистрация пользователей
- ✅ Вход в систему
- ✅ JWT токены (3 дня)
- ✅ Автоматическая авторизация
- ✅ Защита API endpoints
- ✅ Выход из системы
- ✅ Хранение токена в localStorage

### 💬 Чат
- ✅ Личные сообщения
- ✅ Групповые чаты
- ✅ Голосовые сообщения (реальная запись через MediaRecorder)
- ✅ Воспроизведение голосовых с waveform визуализацией
- ✅ Индикатор подключения WebSocket
- ✅ Статусы онлайн/оффлайн (real-time)
- ✅ Счётчик непрочитанных сообщений
- ✅ Эмодзи-панель
- ✅ Создание новых чатов и групп
- ✅ Сохранение сообщений в PostgreSQL

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

### 🗄️ База данных
- ✅ PostgreSQL с миграциями
- ✅ Таблицы: users, chats, chat_participants, messages
- ✅ Индексы для производительности
- ✅ Репозитории для работы с данными
- ✅ Сохранение пользователей, чатов, сообщений

### 🎨 Интерфейс
- ✅ Страница логина/регистрации
- ✅ Тёмная тема
- ✅ Адаптивный дизайн
- ✅ Модалка настроек (5 вкладок)
- ✅ Модалка создания чата
- ✅ Анимации и transitions

## 🚀 Быстрый старт

### Вариант 1: Docker (рекомендуется)

```bash
# Запустить PostgreSQL и сервер
docker-compose up -d

# Собрать фронтенд
npm install
npm run build

# Открыть http://localhost:8080
```

### Вариант 2: Локальная разработка

#### 1. PostgreSQL

```bash
# Установить PostgreSQL и создать базу
createdb gotalk
psql gotalk < server/migrations/001_initial_schema.sql

# Или использовать Docker только для PostgreSQL
docker run -d \
  --name gotalk-postgres \
  -e POSTGRES_USER=gotalk \
  -e POSTGRES_PASSWORD=gotalk \
  -e POSTGRES_DB=gotalk \
  -p 5432:5432 \
  postgres:16-alpine
```

#### 2. Backend (Go)

```bash
cd server

# Установить зависимости
go mod tidy

# Запустить сервер
go run .

# Или собрать и запустить
go build -o gotalk-server
./gotalk-server
```

Сервер запустится на порту 8080.

#### 3. Frontend

```bash
# Установить зависимости
npm install

# Запустить dev server
npm run dev

# Или собрать для production
npm run build
```

## 📡 API Endpoints

### Аутентификация

#### Регистрация
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "john",
  "password": "secret123",
  "displayName": "John Doe",
  "avatar": "👨‍💻"
}
```

#### Вход
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "john",
  "password": "secret123"
}
```

#### Получить текущего пользователя
```bash
GET /api/me
Authorization: Bearer <token>
```

### WebSocket
```
ws://localhost:8080/ws/{userId}
```

### REST API (требует авторизацию)
```bash
GET /api/chats              # Получить все чаты пользователя
GET /api/messages/{chatId}  # Получить сообщения чата
```

## 🗄️ Структура базы данных

### Таблица users
```sql
- id (UUID, PRIMARY KEY)
- username (VARCHAR, UNIQUE)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- display_name (VARCHAR)
- avatar (VARCHAR)
- status (VARCHAR) -- online, offline, busy, away
- last_seen (TIMESTAMP)
- created_at (TIMESTAMP)
```

### Таблица chats
```sql
- id (UUID, PRIMARY KEY)
- type (VARCHAR) -- private, group
- name (VARCHAR)
- avatar (VARCHAR)
- created_by (UUID, FK -> users)
- created_at (TIMESTAMP)
```

### Таблица chat_participants
```sql
- chat_id (UUID, FK -> chats)
- user_id (UUID, FK -> users)
- joined_at (TIMESTAMP)
- last_read_at (TIMESTAMP)
```

### Таблица messages
```sql
- id (UUID, PRIMARY KEY)
- chat_id (UUID, FK -> chats)
- sender_id (UUID, FK -> users)
- text (TEXT)
- type (VARCHAR) -- text, voice, system, file
- voice_duration (INTEGER)
- audio_data (TEXT) -- base64
- waveform (JSONB)
- created_at (TIMESTAMP)
```

## 🔐 Переменные окружения

```bash
# Database
DATABASE_URL=postgres://gotalk:gotalk@localhost:5432/gotalk?sslmode=disable

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Server
PORT=8080
```

## 📝 Структура проекта

```
├── src/
│   ├── App.tsx                    # Главный компонент + роутинг
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
│   │   ├── callManager.ts         # Оркестратор звонков
│   │   └── auth.ts                # Аутентификация (JWT)
│   └── components/
│       ├── LoginPage.tsx          # Страница логина/регистрации
│       ├── Sidebar.tsx            # Боковая панель с чатами
│       ├── ChatWindow.tsx         # Окно чата
│       ├── MessageBubble.tsx      # Компонент сообщения
│       ├── CallOverlay.tsx        # Интерфейс звонка
│       ├── NewChatModal.tsx       # Модалка создания чата
│       └── SettingsModal.tsx      # Настройки
├── server/
│   ├── main.go                    # Основной сервер + WebSocket
│   ├── db.go                      # Подключение к PostgreSQL
│   ├── auth.go                    # JWT аутентификация
│   ├── user_repository.go         # Работа с пользователями
│   ├── chat_repository.go         # Работа с чатами и сообщениями
│   ├── webrtc.go                  # WebRTC signaling
│   ├── migrations/
│   │   └── 001_initial_schema.sql # SQL миграции
│   ├── Dockerfile                 # Docker образ для сервера
│   └── go.mod                     # Go модули
├── docker-compose.yml             # Docker Compose для PostgreSQL + сервер
└── index.html
```

## 🔧 Технические детали

### Аутентификация
- JWT токены с expiration 72 часа
- bcrypt для хэширования паролей (cost: 10)
- Middleware для защиты endpoints
- Автоматическая проверка токена при загрузке

### WebSocket
- Автоматический reconnect при обрыве связи
- Heartbeat каждые 30 секунд
- Экспоненциальная задержка при reconnect
- Обработка событий: `chat-message`, `typing`, `user-status`, `signaling`
- Интеграция с JWT (userID в WebSocket URL)

### Голосовые сообщения
- Запись через `MediaRecorder API`
- Формат: WebM/Opus (или OGG/Opus)
- Визуализация waveform в реальном времени
- Хранение в base64 для передачи через WebSocket
- Сохранение в PostgreSQL
- Воспроизведение через `HTMLAudioElement`

### WebRTC
- Публичные STUN серверы (Google)
- Поддержка voice и video
- Screen sharing через `getDisplayMedia()`
- Signaling через WebSocket
- Управление tracks (mute/camera/screen)

### База данных
- PostgreSQL 16
- Миграции через SQL файлы
- Индексы для производительности
- Триггеры для auto-update timestamps
- Репозитории для работы с данными

## 🚧 Что ещё можно добавить

### Важно
- [ ] Полная интеграция WebRTC P2P (реальные звонки между клиентами)
- [ ] TURN сервер для работы за NAT
- [ ] Загрузка файлов/изображений
- [ ] Редактирование и удаление сообщений
- [ ] Push-уведомления
- [ ] Поиск по сообщениям

### Желательно
- [ ] End-to-end шифрование
- [ ] Реакции на сообщения
- [ ] Пересылка сообщений
- [ ] Истории/статусы
- [ ] CI/CD pipeline
- [ ] Kubernetes deployment

## 📄 Лицензия

MIT
