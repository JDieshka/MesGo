package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var dbPool *pgxpool.Pool

// InitDB initializes the PostgreSQL connection pool
func InitDB() error {
	// Database connection string from environment or default
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://gotalk:gotalk@localhost:5432/gotalk?sslmode=disable"
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return fmt.Errorf("unable to parse database URL: %w", err)
	}

	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	dbPool, err = pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Test connection
	if err := dbPool.Ping(ctx); err != nil {
		return fmt.Errorf("unable to ping database: %w", err)
	}

	log.Println("✅ Database connection established")
	return nil
}

// RunMigrations runs SQL migrations
func RunMigrations() error {
	ctx := context.Background()

	// Read migration file
	migrationSQL, err := os.ReadFile("migrations/001_initial_schema.sql")
	if err != nil {
		return fmt.Errorf("unable to read migration file: %w", err)
	}

	// Execute migration
	_, err = dbPool.Exec(ctx, string(migrationSQL))
	if err != nil {
		return fmt.Errorf("unable to execute migration: %w", err)
	}

	log.Println("✅ Database migrations applied")
	return nil
}

// CloseDB closes the database connection pool
func CloseDB() {
	if dbPool != nil {
		dbPool.Close()
		log.Println("Database connection closed")
	}
}
