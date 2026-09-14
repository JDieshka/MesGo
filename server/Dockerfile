FROM golang:1.21-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod file only
COPY go.mod ./

# Copy source code
COPY . .

# Download dependencies and create go.sum automatically
RUN go mod tidy

# Build the application
RUN go build -o gotalk-server .

# Expose port
EXPOSE 8080

# Run the application
CMD ["./gotalk-server"]
