package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// SearchUsersHandler searches users by username or display name
func SearchUsersHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Query parameter 'q' is required", http.StatusBadRequest)
		return
	}

	currentUserID := r.Context().Value("userID").(uuid.UUID)

	ctx := context.Background()

	// Search users by username or display name (case-insensitive)
	rows, err := dbPool.Query(ctx, `
		SELECT id, username, display_name, avatar, status, last_seen
		FROM users
		WHERE id != $1
		  AND (username ILIKE $2 OR display_name ILIKE $2)
		ORDER BY username
		LIMIT 20
	`, currentUserID, "%"+query+"%")

	if err != nil {
		http.Error(w, "Failed to search users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserSearchResult struct {
		ID          uuid.UUID `json:"id"`
		Username    string    `json:"username"`
		DisplayName string    `json:"displayName"`
		Avatar      string    `json:"avatar"`
		Status      string    `json:"status"`
	}

	var users []UserSearchResult
	for rows.Next() {
		var user UserSearchResult
		err := rows.Scan(&user.ID, &user.Username, &user.DisplayName, &user.Avatar, &user.Status, nil)
		if err != nil {
			continue
		}
		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GetAllUsersHandler returns all users (for demo purposes)
func GetAllUsersHandler(w http.ResponseWriter, r *http.Request) {
	currentUserID := r.Context().Value("userID").(uuid.UUID)

	ctx := context.Background()

	rows, err := dbPool.Query(ctx, `
		SELECT id, username, display_name, avatar, status, last_seen
		FROM users
		WHERE id != $1
		ORDER BY username
	`, currentUserID)

	if err != nil {
		http.Error(w, "Failed to get users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserInfo struct {
		ID          uuid.UUID `json:"id"`
		Username    string    `json:"username"`
		DisplayName string    `json:"displayName"`
		Avatar      string    `json:"avatar"`
		Status      string    `json:"status"`
	}

	var users []UserInfo
	for rows.Next() {
		var user UserInfo
		err := rows.Scan(&user.ID, &user.Username, &user.DisplayName, &user.Avatar, &user.Status, nil)
		if err != nil {
			continue
		}
		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// CreateChatRequest represents request to create a chat
type CreateChatRequest struct {
	Type         string      `json:"type"` // "private" or "group"
	Name         string      `json:"name,omitempty"`
	Avatar       string      `json:"avatar,omitempty"`
	ParticipantIDs []uuid.UUID `json:"participantIds"`
}

// CreateChatHandler creates a new chat
func CreateChatHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	currentUserID := r.Context().Value("userID").(uuid.UUID)

	chatRepo := &ChatRepository{}

	var chat *Chat
	var err error

	if req.Type == "private" {
		// Private chat - should have exactly 1 other participant
		if len(req.ParticipantIDs) != 1 {
			http.Error(w, "Private chat must have exactly 1 participant", http.StatusBadRequest)
			return
		}

		// Check if private chat already exists between these users
		ctx := context.Background()
		var existingChatID uuid.UUID
		err := dbPool.QueryRow(ctx, `
			SELECT c.id FROM chats c
			JOIN chat_participants cp1 ON c.id = cp1.chat_id
			JOIN chat_participants cp2 ON c.id = cp2.chat_id
			WHERE c.type = 'private'
			  AND cp1.user_id = $1
			  AND cp2.user_id = $2
		`, currentUserID, req.ParticipantIDs[0]).Scan(&existingChatID)

		if err == nil {
			// Chat already exists, return it
			chat, err = chatRepo.GetChatByID(existingChatID)
			if err != nil {
				http.Error(w, "Failed to get existing chat", http.StatusInternalServerError)
				return
			}
		} else {
			// Create new private chat
			chat, err = chatRepo.CreatePrivateChat(currentUserID, req.ParticipantIDs[0])
			if err != nil {
				http.Error(w, "Failed to create private chat", http.StatusInternalServerError)
				return
			}
		}
	} else if req.Type == "group" {
		// Group chat
		if req.Name == "" {
			http.Error(w, "Group chat must have a name", http.StatusBadRequest)
			return
		}

		if len(req.ParticipantIDs) < 1 {
			http.Error(w, "Group chat must have at least 1 participant", http.StatusBadRequest)
			return
		}

		// Add current user to participants
		allParticipants := append([]uuid.UUID{currentUserID}, req.ParticipantIDs...)

		avatar := req.Avatar
		if avatar == "" {
			avatar = "💬"
		}

		chat, err = chatRepo.CreateGroupChat(req.Name, avatar, currentUserID, allParticipants)
		if err != nil {
			http.Error(w, "Failed to create group chat", http.StatusInternalServerError)
			return
		}
	} else {
		http.Error(w, "Invalid chat type", http.StatusBadRequest)
		return
	}

	// Get participants
	participants, err := chatRepo.GetChatParticipants(chat.ID)
	if err != nil {
		http.Error(w, "Failed to get chat participants", http.StatusInternalServerError)
		return
	}

	// Response
	type ChatResponse struct {
		Chat         *Chat  `json:"chat"`
		Participants []User `json:"participants"`
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ChatResponse{
		Chat:         chat,
		Participants: participants,
	})
}

// GetUserChatsWithDetailsHandler returns user's chats with participants and last message
func GetUserChatsWithDetailsHandler(w http.ResponseWriter, r *http.Request) {
	currentUserID := r.Context().Value("userID").(uuid.UUID)

	chatRepo := &ChatRepository{}
	msgRepo := &MessageRepository{}

	chats, err := chatRepo.GetUserChats(currentUserID)
	if err != nil {
		http.Error(w, "Failed to get chats", http.StatusInternalServerError)
		return
	}

	type ChatWithDetails struct {
		Chat         *Chat     `json:"chat"`
		Participants []User    `json:"participants"`
		LastMessage  *Message  `json:"lastMessage,omitempty"`
		UnreadCount  int       `json:"unreadCount"`
	}

	var result []ChatWithDetails

	for _, chat := range chats {
		// Get participants
		participants, err := chatRepo.GetChatParticipants(chat.ID)
		if err != nil {
			continue
		}

		// Get last message
		messages, err := msgRepo.GetChatMessages(chat.ID, 1, 0)
		if err != nil || len(messages) == 0 {
			result = append(result, ChatWithDetails{
				Chat:         &chat,
				Participants: participants,
				UnreadCount:  0,
			})
			continue
		}

		// Get unread count
		unreadCount, _ := msgRepo.GetUnreadCount(chat.ID, currentUserID)

		result = append(result, ChatWithDetails{
			Chat:         &chat,
			Participants: participants,
			LastMessage:  &messages[0],
			UnreadCount:  unreadCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// MarkChatAsReadHandler marks all messages in a chat as read for the current user
func MarkChatAsReadHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatIDStr := vars["chatId"]

	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		http.Error(w, "Invalid chat ID", http.StatusBadRequest)
		return
	}

	currentUserID := r.Context().Value("userID").(uuid.UUID)

	msgRepo := &MessageRepository{}
	if err := msgRepo.MarkAsRead(chatID, currentUserID); err != nil {
		http.Error(w, "Failed to mark as read", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// Helper function to get chat by ID
func (r *ChatRepository) GetChatByID(chatID uuid.UUID) (*Chat, error) {
	ctx := context.Background()

	var chat Chat
	err := dbPool.QueryRow(ctx, `
		SELECT id, type, name, avatar, created_by, created_at
		FROM chats WHERE id = $1
	`, chatID).Scan(
		&chat.ID, &chat.Type, &chat.Name, &chat.Avatar, &chat.CreatedBy, &chat.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &chat, nil
}

// Helper to check if string contains substring (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
