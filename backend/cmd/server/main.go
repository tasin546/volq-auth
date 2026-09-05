package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/volq-auth/volq-auth/internal/cache"
	"github.com/volq-auth/volq-auth/internal/config"
	"github.com/volq-auth/volq-auth/internal/crypto"
	"github.com/volq-auth/volq-auth/internal/database"
	"github.com/volq-auth/volq-auth/internal/handler"
	"github.com/volq-auth/volq-auth/internal/middleware"
	"github.com/volq-auth/volq-auth/internal/models"
	"github.com/volq-auth/volq-auth/internal/repository"
	"github.com/volq-auth/volq-auth/internal/service"
)

func main() {
	log.Println("================================================================================")
	log.Println("   VOLQ-AUTH (OPENKEYAUTH) - ZERO-COST ANTI-TAMPER LICENSING PLATFORM")
	log.Println("================================================================================")

	// 1. Load configuration
	cfg := config.Load()

	// 2. Initialize Database & Repositories (Dual-mode: PostgreSQL or Local Standalone Store)
	var appRepo repository.AppRepository
	var licenseRepo repository.LicenseRepository
	var userRepo repository.UserRepository
	var varRepo repository.VariableRepository
	var fileRepo repository.FileRepository
	var logRepo repository.LogRepository
	var resellerRepo repository.ResellerRepository

	db, err := database.Connect(cfg.DatabaseURL)
	if err == nil && db != nil {
		defer db.Close()
		log.Println("[DATABASE] PostgreSQL connected. Running in Cloud/Production mode.")
		if err := db.RunMigrations("migrations/001_initial_schema.sql"); err != nil {
			log.Printf("[WARNING] Migration runner warning: %v", err)
		}
		appRepo = repository.NewSQLAppRepository(db)
		licenseRepo = repository.NewSQLLicenseRepository(db)
		userRepo = repository.NewSQLUserRepository(db)
		varRepo = repository.NewSQLVariableRepository(db)
		fileRepo = repository.NewSQLFileRepository(db)
		logRepo = repository.NewSQLLogRepository(db)
		resellerRepo = repository.NewSQLResellerRepository(db)
	} else {
		log.Println("================================================================================")
		log.Printf("[DATABASE] PostgreSQL connection failed: %v", err)
		log.Println("[DATABASE] Seamlessly activating Local Standalone Mode (Zero-Dependency Engine).")
		log.Println("[DATABASE] Data will automatically persist locally to 'volq_data.json'.")
		log.Println("================================================================================")
		localStore := repository.NewMemoryStore("volq_data.json")
		appRepo = localStore.AppRepo()
		licenseRepo = localStore.LicenseRepo()
		userRepo = localStore.UserRepo()
		varRepo = localStore.VarRepo()
		fileRepo = localStore.FileRepo()
		logRepo = localStore.LogRepo()
		resellerRepo = localStore.ResellerRepo()
	}

	// 3. Initialize Cache & Rate-limit store (Redis or In-Memory fallback)
	cacheEngine := cache.NewCache(cfg.RedisURL)

	// 4. Seed default administrator if not present
	seedDefaultAdmin(appRepo, cfg)

	// 6. Initialize Services
	licenseEng := service.NewLicenseEngine()
	hwidSvc := service.NewHWIDService()
	webhookSvc := service.NewWebhookService()
	clientAuthSvc := service.NewClientAuthService(
		appRepo, licenseRepo, userRepo, varRepo, fileRepo, logRepo, cacheEngine, licenseEng, hwidSvc, webhookSvc,
	)

	// 7. Initialize Handlers
	clientHdr := handler.NewClientHandler(clientAuthSvc)
	dashboardHdr := handler.NewDashboardHandler(
		cfg, appRepo, licenseRepo, userRepo, varRepo, fileRepo, logRepo, resellerRepo, licenseEng,
	)

	// 8. Configure Gin Router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// CORS configuration for Render / Cloudflare / Next.js Dashboard
	r.Use(cors.New(cors.Config{
		AllowOriginFunc:  func(origin string) bool { return true },
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// ---------------------------------------------------------------------------
	// API ROUTES
	// ---------------------------------------------------------------------------

	// Root health check
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"platform": "VOLQ-Auth (OpenKeyAuth)",
			"status":   "operational",
			"license":  "Open Source MIT / AGPLv3",
			"tier":     "100% Free-Tier Architecture",
		})
	})

	api := r.Group("/api/v1")
	{
		// 1. High-performance Client SDK endpoints (Sliding window rate limited: 60 req/min/IP)
		clientGroup := api.Group("/client")
		clientGroup.Use(middleware.RateLimiter(cacheEngine, 60, time.Minute))
		{
			clientGroup.GET("/ping", clientHdr.Ping)
			clientGroup.POST("/init", clientHdr.Init)
			clientGroup.POST("/license", clientHdr.License)
			clientGroup.POST("/login", clientHdr.Login)
			clientGroup.POST("/var", clientHdr.Variable)
		}

		// 2. Developer Dashboard Auth
		dashAuth := api.Group("/dashboard/auth")
		{
			dashAuth.POST("/register", dashboardHdr.Register)
			dashAuth.POST("/login", dashboardHdr.Login)
			dashAuth.GET("/me", middleware.AuthRequired(cfg.JWTSecret), dashboardHdr.Me)
		}

		// 3. Developer & Reseller Management API (Protected by JWT)
		dash := api.Group("/dashboard")
		dash.Use(middleware.AuthRequired(cfg.JWTSecret))
		{
			// Applications
			dash.GET("/apps", dashboardHdr.ListApps)
			dash.POST("/apps/create", middleware.RequireRole("admin", "developer"), dashboardHdr.CreateApp)
			dash.GET("/apps/:id", dashboardHdr.GetApp)
			dash.PUT("/apps/:id", middleware.RequireRole("admin", "developer"), dashboardHdr.UpdateApp)
			dash.DELETE("/apps/:id", middleware.RequireRole("admin", "developer"), dashboardHdr.DeleteApp)

			// Licenses
			dash.GET("/apps/:id/licenses", dashboardHdr.ListLicenses)
			dash.POST("/apps/:id/licenses/generate", dashboardHdr.GenerateLicenses)
			dash.PUT("/apps/:id/licenses/:lic_id/reset-hwid", dashboardHdr.ResetHWID)
			dash.PUT("/apps/:id/licenses/:lic_id/status", middleware.RequireRole("admin", "developer"), dashboardHdr.UpdateLicenseStatus)
			dash.DELETE("/apps/:id/licenses/:lic_id", middleware.RequireRole("admin", "developer"), dashboardHdr.DeleteLicense)
			dash.GET("/apps/:id/licenses/export", dashboardHdr.ExportLicensesCSV)

			// End-Users (Mode B)
			dash.GET("/apps/:id/users", dashboardHdr.ListUsers)
			dash.PUT("/apps/:id/users/:user_id/ban", middleware.RequireRole("admin", "developer"), dashboardHdr.BanUser)
			dash.DELETE("/apps/:id/users/:user_id", middleware.RequireRole("admin", "developer"), dashboardHdr.DeleteUser)

			// Remote Variables
			dash.GET("/apps/:id/variables", dashboardHdr.ListVariables)
			dash.POST("/apps/:id/variables", middleware.RequireRole("admin", "developer"), dashboardHdr.SaveVariable)
			dash.DELETE("/apps/:id/variables/:var_id", middleware.RequireRole("admin", "developer"), dashboardHdr.DeleteVariable)

			// Cloud Files
			dash.GET("/apps/:id/files", dashboardHdr.ListFiles)
			dash.POST("/apps/:id/files", middleware.RequireRole("admin", "developer"), dashboardHdr.CreateFile)
			dash.DELETE("/apps/:id/files/:file_id", middleware.RequireRole("admin", "developer"), dashboardHdr.DeleteFile)

			// Security Logs
			dash.GET("/apps/:id/logs", dashboardHdr.ListLogs)

			// Resellers
			dash.GET("/apps/:id/resellers", middleware.RequireRole("admin", "developer"), dashboardHdr.ListResellers)
			dash.POST("/apps/:id/resellers/create", middleware.RequireRole("admin", "developer"), dashboardHdr.CreateReseller)
			dash.POST("/apps/:id/resellers/:reseller_id/credits", middleware.RequireRole("admin", "developer"), dashboardHdr.AdjustResellerCredits)
		}
	}

	// 9. HTTP Server with graceful shutdown
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("[STARTUP] VOLQ-Auth Gateway listening on port %s...", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[FATAL] HTTP server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[SHUTDOWN] Shutting down VOLQ-Auth Gateway gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("[FATAL] Server forced to shutdown: %v", err)
	}

	log.Println("[SHUTDOWN] Server exited cleanly.")
}

func seedDefaultAdmin(appRepo repository.AppRepository, cfg *config.Config) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	existing, _ := appRepo.GetDeveloperByUsername(ctx, cfg.DefaultAdminUser)
	if existing == nil || existing.PasswordHash == "" {
		hash, _ := crypto.HashPassword(cfg.DefaultAdminPass)
		admin := &models.Developer{
			Username:     cfg.DefaultAdminUser,
			Email:        cfg.DefaultAdminEmail,
			PasswordHash: hash,
			Role:         "admin",
		}
		if err := appRepo.CreateDeveloper(ctx, admin); err == nil {
			log.Printf("[SEED] Default admin user initialized: '%s'", cfg.DefaultAdminUser)
		}
	}
}
