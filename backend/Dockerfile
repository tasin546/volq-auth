# Multi-stage build for minimal binary footprint
FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy Go manifests (supports both Root Directory = / and Root Directory = /backend)
COPY . .

# Compile statically for Linux amd64
RUN if [ -f "go.mod" ]; then \
      CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server ./cmd/server; \
    elif [ -f "backend/go.mod" ]; then \
      cd backend && CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server ./cmd/server && cp -r migrations /app/migrations; \
    fi

FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/server /app/server
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

CMD ["/app/server"]
