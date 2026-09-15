-- Тестовые пользователи для GoTalk
-- Пароль для всех: test123 (bcrypt hash)

INSERT INTO users (username, email, password_hash, display_name, avatar, status) VALUES
('alice', 'alice@gotalk.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Алиса Иванова', '👩‍💼', 'online'),
('bob', 'bob@gotalk.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Борис Петров', '👨‍💻', 'online'),
('charlie', 'charlie@gotalk.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Чарли Смирнов', '🧑‍🎨', 'offline'),
('diana', 'diana@gotalk.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Диана Козлова', '👩‍🔬', 'away'),
('eve', 'eve@gotalk.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Ева Волкова', '👩‍🏫', 'online');
