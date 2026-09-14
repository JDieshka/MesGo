package main

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Chat represents a chat in the database
type Chat struct {
	ID        uuid.UUID `json:"id"`
	Type      string    `json:"type"`
	Name      string    `json:"name"`
	Avatar    string    `json:"avatar"`
	CreatedBy uuid.UUID `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

// Message represents a message in the database
type Message struct {
	ID            uuid.UUID   `json:"id"`
	ChatID        uuid.UUID   `json:"chatId"`
	SenderID      uuid.UUID   `json:"senderId"`
	Text          string      `json:"text"`
	Type          string      `json:"type"`
	VoiceDuration int         `json:"voiceDuration,omitempty"`
	AudioData     string      `json:"audioData,omitempty"`
	Waveform      []float64   `json:"waveform,omitempty"`
	CreatedAt     time.Time   `json:"createdAt"`
}

// ChatRepository handles chat database operations
type ChatRepository struct{}

// CreatePrivateChat creates a private chat between two users
func (r *ChatRepository) CreatePrivateChat(user1ID, user2ID uuid.UUID) (*Chat, error) {
	ctx := context.Background()

	var chat Chat
	err := dbPool.QueryRow(ctx, `
		INSERT INTO chats (type, created_by)
		VALUES ('private', $1)
		RETURNING id, type, name, avatar, created_by, created_at
	`, user1ID).Scan(
		&chat.ID, &chat.Type, &chat.Name, &chat.Avatar, &chat.CreatedBy, &chat.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Add participants
	_, err = dbPool.Exec(ctx, `
		INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)
	`, chat.ID, user1ID, user2ID)
	if err != nil {
		return nil, err
	}

	return &chat, nil
}

// CreateGroupChat creates a group chat
func (r *ChatRepository) CreateGroupChat(name, avatar string, createdBy uuid.UUID, participantIDs []uuid.UUID) (*Chat, error) {
	ctx := context.Background()

	var chat Chat
	err := dbPool.QueryRow(ctx, `
		INSERT INTO chats (type, name, avatar, created_by)
		VALUES ('group', $1, $2, $3)
		RETURNING id, type, name, avatar, created_by, created_at
	`, name, avatar, createdBy).Scan(
		&chat.ID, &chat.Type, &chat.Name, &chat.Avatar, &chat.CreatedBy, &chat.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Add participants
	for _, userID := range participantIDs {
		_, err = dbPool.Exec(ctx, `
			INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2)
		`, chat.ID, userID)
		if err != nil {
			return nil, err
		}
	}

	return &chat, nil
}

// GetUserChats returns all chats for a user
func (r *ChatRepository) GetUserChats(userID uuid.UUID) ([]Chat, error) {
	ctx := context.Background()

	rows, err := dbPool.Query(ctx, `
		SELECT c.id, c.type, c.name, c.avatar, c.created_by, c.created_at
		FROM chats c
		JOIN chat_participants cp ON c.id = cp.chat_id
		WHERE cp.user_id = $1
		ORDER BY c.updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chats []Chat
	for rows.Next() {
		var chat Chat
		err := rows.Scan(&chat.ID, &chat.Type, &chat.Name, &chat.Avatar, &chat.CreatedBy, &chat.CreatedAt)
		if err != nil {
			return nil, err
		}
		chats = append(chats, chat)
	}

	return chats, nil
}

// GetChatParticipants returns all participants of a chat
func (r *ChatRepository) GetChatParticipants(chatID uuid.UUID) ([]User, error) {
	ctx := context.Background()

	rows, err := dbPool.Query(ctx, `
		SELECT u.id, u.username, u.email, u.display_name, u.avatar, u.status, u.last_seen, u.created_at
		FROM users u
		JOIN chat_participants cp ON u.id = cp.user_id
		WHERE cp.chat_id = $1
	`, chatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.DisplayName,
			&user.Avatar, &user.Status, &user.LastSeen, &user.CreatedAt)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

// MessageRepository handles message database operations
type MessageRepository struct{}

// SaveMessage saves a message to the database
func (r *MessageRepository) SaveMessage(chatID, senderID uuid.UUID, text, msgType string, voiceDuration int, audioData string, waveform []float64) (*Message, error) {
	ctx := context.Background()

	// Convert waveform to JSON
	waveformJSON, err := json.Marshal(waveform)
	if err != nil {
		waveformJSON = []byte("[]")
	}

	var msg Message
	err = dbPool.QueryRow(ctx, `
		INSERT INTO messages (chat_id, sender_id, text, type, voice_duration, audio_data, waveform)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, chat_id, sender_id, text, type, voice_duration, audio_data, created_at
	`, chatID, senderID, text, msgType, voiceDuration, audioData, waveformJSON).Scan(
		&msg.ID, &msg.ChatID, &msg.SenderID, &msg.Text, &msg.Type,
		&msg.VoiceDuration, &msg.AudioData, &msg.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Update chat's updated_at
	_, err = dbPool.Exec(ctx, `UPDATE chats SET updated_at = NOW() WHERE id = $1`, chatID)
	if err != nil {
		return nil, err
	}

	return &msg, nil
}

// GetChatMessages returns messages for a chat
func (r *MessageRepository) GetChatMessages(chatID uuid.UUID, limit, offset int) ([]Message, error) {
	ctx := context.Background()

	if limit <= 0 {
		limit = 50
	}

	rows, err := dbPool.Query(ctx, `
		SELECT id, chat_id, sender_id, text, type, voice_duration, audio_data, created_at
		FROM messages
		WHERE chat_id = $1 AND is_deleted = false
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, chatID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		err := rows.Scan(&msg.ID, &msg.ChatID, &msg.SenderID, &msg.Text, &msg.Type,
			&msg.VoiceDuration, &msg.AudioData, &msg.CreatedAt)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// GetUnreadCount returns unread message count for a user in a chat
func (r *MessageRepository) GetUnreadCount(chatID, userID uuid.UUID) (int, error) {
	ctx := context.Background()

	var count int
	err := dbPool.QueryRow(ctx, `
		SELECT COUNT(*) FROM messages m
		JOIN chat_participants cp ON m.chat_id = cp.chat_id
		WHERE m.chat_id = $1
		  AND cp.user_id = $2
		  AND m.sender_id != $2
		  AND m.created_at > cp.last_read_at
		  AND m.is_deleted = false
	`, chatID, userID).Scan(&count)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}

	return count, nil
}

// MarkAsRead updates last_read_at for a user in a chat
func (r *MessageRepository) MarkAsRead(chatID, userID uuid.UUID) error {
	ctx := context.Background()
	_, err := dbPool.Exec(ctx, `
		UPDATE chat_participants SET last_read_at = NOW()
		WHERE chat_id = $1 AND user_id = $2
	`, chatID, userID)
	return err
}
