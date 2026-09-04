package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds all server configuration variables
type Config struct {
	Port               string
	DatabaseURL        string
	RedisURL           string
	JWTSecret          string
	ServerMasterKey    string // 32-byte hex key for encrypting sensitive fields at rest
	R2AccountID        string
	R2AccessKeyID      string
	R2AccessKeySecret  string
	R2BucketName       string
	Environment        string // development or production
	DefaultAdminUser   string
	DefaultAdminPass   string
	DefaultAdminEmail  string
}

func loadDotEnv() {
	paths := []string{".env", "../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.Trim(strings.TrimSpace(parts[1]), "\"'`\r")
				if os.Getenv(k) == "" {
					_ = os.Setenv(k, v)
				}
			}
		}
	}
}

// Load reads configuration from environment variables with sensible zero-cost defaults
func Load() *Config {
	loadDotEnv()
	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/volq_auth?sslmode=disable")
	redisURL := getEnv("REDIS_URL", "") // Empty defaults to internal memory cache!
	jwtSecret := getEnv("JWT_SECRET", "volq_super_secret_jwt_key_32bytes_min!")
	masterKey := getEnv("SERVER_MASTER_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")

	return &Config{
		Port:              port,
		DatabaseURL:       dbURL,
		RedisURL:          redisURL,
		JWTSecret:         jwtSecret,
		ServerMasterKey:   masterKey,
		R2AccountID:       getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:     getEnv("R2_ACCESS_KEY_ID", ""),
		R2AccessKeySecret: getEnv("R2_ACCESS_KEY_SECRET", ""),
		R2BucketName:      getEnv("R2_BUCKET_NAME", "volq-auth-payloads"),
		Environment:       getEnv("ENV", "development"),
		DefaultAdminUser:  getEnv("ADMIN_USER", "admin"),
		DefaultAdminPass:  getEnv("ADMIN_PASS", "Admin1234!"),
		DefaultAdminEmail: getEnv("ADMIN_EMAIL", "admin@volq-auth.local"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return fallback
}
