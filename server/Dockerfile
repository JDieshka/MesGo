FROM golang:1.21-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN go build -o gotalk-server .

# Expose port
EXPOSE 8080

# Run the application
CMD ["./gotalk-server"]
