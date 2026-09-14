package main

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// User represents a user in the database
type User struct {
	ID           uuid.UUID `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	DisplayName  string    `json:"displayName"`
	Avatar       string    `json:"avatar"`
	Status       string    `json:"status"`
	LastSeen     time.Time `json:"lastSeen"`
	CreatedAt    time.Time `json:"createdAt"`
}

// UserRepository handles user database operations
type UserRepository struct{}

// CreateUser creates a new user
func (r *UserRepository) CreateUser(username, email, password, displayName, avatar string) (*User, error) {
	ctx := context.Background()

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var user User
	err = dbPool.QueryRow(ctx, `
		INSERT INTO users (username, email, password_hash, display_name, avatar)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, username, email, display_name, avatar, status, last_seen, created_at
	`, username, email, string(hashedPassword), displayName, avatar).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName,
		&user.Avatar, &user.Status, &user.LastSeen, &user.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserByUsername finds a user by username
func (r *UserRepository) GetUserByUsername(username string) (*User, string, error) {
	ctx := context.Background()

	var user User
	var passwordHash string
	err := dbPool.QueryRow(ctx, `
		SELECT id, username, email, display_name, avatar, status, last_seen, created_at, password_hash
		FROM users WHERE username = $1
	`, username).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName,
		&user.Avatar, &user.Status, &user.LastSeen, &user.CreatedAt, &passwordHash,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", nil
		}
		return nil, "", err
	}

	return &user, passwordHash, nil
}

// GetUserByID finds a user by ID
func (r *UserRepository) GetUserByID(id uuid.UUID) (*User, error) {
	ctx := context.Background()

	var user User
	err := dbPool.QueryRow(ctx, `
		SELECT id, username, email, display_name, avatar, status, last_seen, created_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName,
		&user.Avatar, &user.Status, &user.LastSeen, &user.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

// UpdateUserStatus updates user's online status
func (r *UserRepository) UpdateUserStatus(id uuid.UUID, status string) error {
	ctx := context.Background()
	_, err := dbPool.Exec(ctx, `
		UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2
	`, status, id)
	return err
}

// VerifyPassword checks if password matches hash
func VerifyPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
