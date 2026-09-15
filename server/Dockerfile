# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy go mod file only
COPY go.mod ./

# Download dependencies and create go.sum automatically
RUN go mod tidy

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o gotalk-server .

# Production stage
FROM alpine:3.19

WORKDIR /app

# Install ca-certificates for HTTPS requests and wget for healthcheck
RUN apk add --no-cache ca-certificates wget tzdata

# Create non-root user for security
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -D appuser

# Copy binary from builder
COPY --from=builder /app/gotalk-server .

# Create directories for certs and dist
RUN mkdir -p /app/certs /app/dist && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./gotalk-server"]
