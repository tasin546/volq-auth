package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/volq-auth/volq-auth/internal/config"
	"github.com/volq-auth/volq-auth/internal/crypto"
	"github.com/volq-auth/volq-auth/internal/middleware"
	"github.com/volq-auth/volq-auth/internal/models"
	"github.com/volq-auth/volq-auth/internal/repository"
	"github.com/volq-auth/volq-auth/internal/service"
)

type DashboardHandler struct {
	cfg          *config.Config
	appRepo      repository.AppRepository
	licenseRepo  repository.LicenseRepository
	userRepo     repository.UserRepository
	varRepo      repository.VariableRepository
	fileRepo     repository.FileRepository
	logRepo      repository.LogRepository
	resellerRepo repository.ResellerRepository
	licenseEng   *service.LicenseEngine
}

func NewDashboardHandler(
	cfg *config.Config,
	appRepo repository.AppRepository,
	licenseRepo repository.LicenseRepository,
	userRepo repository.UserRepository,
	varRepo repository.VariableRepository,
	fileRepo repository.FileRepository,
	logRepo repository.LogRepository,
	resellerRepo repository.ResellerRepository,
	licenseEng *service.LicenseEngine,
) *DashboardHandler {
	return &DashboardHandler{
		cfg:          cfg,
		appRepo:      appRepo,
		licenseRepo:  licenseRepo,
		userRepo:     userRepo,
		varRepo:      varRepo,
		fileRepo:     fileRepo,
		logRepo:      logRepo,
		resellerRepo: resellerRepo,
		licenseEng:   licenseEng,
	}
}

// ---------------------------------------------------------------------------
// AUTHENTICATION
// ---------------------------------------------------------------------------

func (h *DashboardHandler) Register(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := crypto.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process credentials"})
		return
	}

	dev := &models.Developer{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         "developer",
	}

	if err := h.appRepo.CreateDeveloper(c.Request.Context(), dev); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username or email already exists"})
		return
	}

	token, _ := middleware.GenerateToken(dev.ID, dev.Role, "", h.cfg.JWTSecret, 72*time.Hour)

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"developer": gin.H{
			"id":       dev.ID,
			"username": dev.Username,
			"email":    dev.Email,
			"role":     dev.Role,
		},
	})
}

func (h *DashboardHandler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// First check developers table
	dev, err := h.appRepo.GetDeveloperByUsername(c.Request.Context(), req.Username)
	if err == nil && dev != nil {
		valid, _ := crypto.VerifyPassword(req.Password, dev.PasswordHash)
		if valid {
			token, _ := middleware.GenerateToken(dev.ID, dev.Role, "", h.cfg.JWTSecret, 72*time.Hour)
			c.JSON(http.StatusOK, gin.H{
				"token": token,
				"developer": gin.H{
					"id":       dev.ID,
					"username": dev.Username,
					"email":    dev.Email,
					"role":     dev.Role,
				},
			})
			return
		}
	}

	// Also check reseller table for sub-vendor login
	res, err := h.resellerRepo.GetByUsername(c.Request.Context(), req.Username)
	if err == nil && res != nil && res.IsActive {
		valid, _ := crypto.VerifyPassword(req.Password, res.PasswordHash)
		if valid {
			token, _ := middleware.GenerateToken(res.ID, "reseller", res.AppID, h.cfg.JWTSecret, 72*time.Hour)
			c.JSON(http.StatusOK, gin.H{
				"token": token,
				"developer": gin.H{
					"id":       res.ID,
					"username": res.Username,
					"role":     "reseller",
					"app_id":   res.AppID,
					"credits":  res.Credits,
				},
			})
			return
		}
	}

	c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
}

func (h *DashboardHandler) Me(c *gin.Context) {
	userID := c.GetString("user_id")
	role := c.GetString("role")

	if role == "reseller" {
		res, err := h.resellerRepo.GetByID(c.Request.Context(), userID)
		if err != nil || res == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": res, "role": "reseller"})
		return
	}

	dev, err := h.appRepo.GetDeveloperByID(c.Request.Context(), userID)
	if err != nil || dev == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": dev, "role": dev.Role})
}

// ---------------------------------------------------------------------------
// APPLICATIONS
// ---------------------------------------------------------------------------

func (h *DashboardHandler) ListApps(c *gin.Context) {
	userID := c.GetString("user_id")
	role := c.GetString("role")

	if role == "reseller" {
		appID := c.GetString("app_id")
		app, err := h.appRepo.GetByID(c.Request.Context(), appID)
		if err != nil || app == nil {
			c.JSON(http.StatusOK, []models.Application{})
			return
		}
		c.JSON(http.StatusOK, []models.Application{*app})
		return
	}

	apps, err := h.appRepo.ListByDeveloper(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if apps == nil {
		apps = []models.Application{}
	}
	c.JSON(http.StatusOK, apps)
}

func (h *DashboardHandler) CreateApp(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		Name             string `json:"name" binding:"required"`
		Version          string `json:"version"`
		DownloadURL      string `json:"download_url"`
		IntegrityHash    string `json:"integrity_hash"`
		HWIDLockEnabled  *bool  `json:"hwid_lock_enabled"`
		HWIDCooldownDays int    `json:"hwid_cooldown_days"`
		WebhookURL       string `json:"webhook_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Version == "" {
		req.Version = "1.0.0"
	}
	hwidLock := true
	if req.HWIDLockEnabled != nil {
		hwidLock = *req.HWIDLockEnabled
	}
	if req.HWIDCooldownDays <= 0 {
		req.HWIDCooldownDays = 7
	}

	// Generate Master Ed25519 keypair for cryptographic response signing
	pubKey, privKey, err := crypto.GenerateEd25519KeyPair()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate master cryptographic keys"})
		return
	}

	// Generate App Secret
	appSecret := uuid.New().String()
	secretHasher := sha256.New()
	secretHasher.Write([]byte(appSecret))
	secretHash := hex.EncodeToString(secretHasher.Sum(nil))

	app := &models.Application{
		DeveloperID:         userID,
		Name:                req.Name,
		SecretHash:          secretHash,
		MasterPublicKey:     pubKey,
		MasterPrivateKeyEnc: privKey,
		Version:             req.Version,
		DownloadURL:         req.DownloadURL,
		IntegrityHash:       req.IntegrityHash,
		HWIDLockEnabled:     hwidLock,
		HWIDCooldownDays:    req.HWIDCooldownDays,
		WebhookURL:          req.WebhookURL,
		WebhookEnabled:      req.WebhookURL != "",
	}

	if err := h.appRepo.Create(c.Request.Context(), app); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create default Standard subscription tier
	_ = h.licenseRepo.CreateSubscription(c.Request.Context(), &models.Subscription{
		AppID:     app.ID,
		Name:      "Standard",
		TierLevel: 1,
	})

	c.JSON(http.StatusCreated, gin.H{
		"application": app,
		"app_secret":  appSecret, // Returned ONCE upon creation!
	})
}

func (h *DashboardHandler) GetApp(c *gin.Context) {
	appID := c.Param("id")
	app, err := h.appRepo.GetByID(c.Request.Context(), appID)
	if err != nil || app == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}
	c.JSON(http.StatusOK, app)
}

func (h *DashboardHandler) UpdateApp(c *gin.Context) {
	appID := c.Param("id")
	app, err := h.appRepo.GetByID(c.Request.Context(), appID)
	if err != nil || app == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}

	var req struct {
		Name             string `json:"name"`
		Version          string `json:"version"`
		DownloadURL      string `json:"download_url"`
		IntegrityHash    string `json:"integrity_hash"`
		IsPaused         *bool  `json:"is_paused"`
		HWIDLockEnabled  *bool  `json:"hwid_lock_enabled"`
		HWIDCooldownDays *int   `json:"hwid_cooldown_days"`
		WebhookURL       string `json:"webhook_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" {
		app.Name = req.Name
	}
	if req.Version != "" {
		app.Version = req.Version
	}
	app.DownloadURL = req.DownloadURL
	app.IntegrityHash = req.IntegrityHash
	if req.IsPaused != nil {
		app.IsPaused = *req.IsPaused
	}
	if req.HWIDLockEnabled != nil {
		app.HWIDLockEnabled = *req.HWIDLockEnabled
	}
	if req.HWIDCooldownDays != nil {
		app.HWIDCooldownDays = *req.HWIDCooldownDays
	}
	app.WebhookURL = req.WebhookURL
	app.WebhookEnabled = req.WebhookURL != ""

	if err := h.appRepo.Update(c.Request.Context(), app); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

func (h *DashboardHandler) DeleteApp(c *gin.Context) {
	appID := c.Param("id")
	if err := h.appRepo.Delete(c.Request.Context(), appID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Application deleted successfully"})
}

// ---------------------------------------------------------------------------
// LICENSES
// ---------------------------------------------------------------------------

func (h *DashboardHandler) ListLicenses(c *gin.Context) {
	appID := c.Param("id")
	status := c.DefaultQuery("status", "all")
	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	licenses, total, err := h.licenseRepo.ListByApp(c.Request.Context(), appID, status, search, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if licenses == nil {
		licenses = []models.License{}
	}

	c.JSON(http.StatusOK, gin.H{
		"licenses": licenses,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

func (h *DashboardHandler) GenerateLicenses(c *gin.Context) {
	appID := c.Param("id")
	userID := c.GetString("user_id")
	role := c.GetString("role")

	var req struct {
		Count           int    `json:"count" binding:"required,min=1,max=10000"`
		Mask            string `json:"mask"` // e.g. "VOLQ-XXXX-XXXX-XXXX"
		DurationDays    int    `json:"duration_days"`
		IsLifetime      bool   `json:"is_lifetime"`
		SubscriptionID  *string `json:"subscription_id"`
		MaxHWIDs        int    `json:"max_hwids"`
		Note            string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Mask == "" {
		req.Mask = "VOLQ-XXXX-XXXX-XXXX"
	}
	if req.MaxHWIDs <= 0 {
		req.MaxHWIDs = 1
	}

	// Reseller credit check
	if role == "reseller" {
		requiredCredits := req.Count * req.DurationDays
		if req.IsLifetime {
			requiredCredits = req.Count * 365 // Lifetime costs 365 credits per key for resellers
		}
		ok, err := h.resellerRepo.DeductCredits(c.Request.Context(), userID, requiredCredits)
		if err != nil || !ok {
			c.JSON(http.StatusPaymentRequired, gin.H{"error": "Insufficient reseller credits to generate requested keys"})
			return
		}
	}

	keys, err := h.licenseEng.GenerateBatch(req.Mask, req.Count)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var durationSeconds int64 = int64(req.DurationDays) * 86400
	if req.IsLifetime {
		durationSeconds = 0
	}

	licModels := make([]*models.License, len(keys))
	for i, key := range keys {
		licModels[i] = &models.License{
			AppID:           appID,
			SubscriptionID:  req.SubscriptionID,
			LicenseKey:      key,
			DurationSeconds: durationSeconds,
			IsLifetime:      req.IsLifetime,
			MaxHWIDs:        req.MaxHWIDs,
			Status:          models.LicenseStatusUnactivated,
			CreatedBy:       &userID,
			Note:            req.Note,
		}
	}

	if err := h.licenseRepo.BulkCreate(c.Request.Context(), licModels); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": fmt.Sprintf("Successfully generated %d license keys", len(keys)),
		"keys":    keys,
	})
}

func (h *DashboardHandler) ResetHWID(c *gin.Context) {
	licID := c.Param("lic_id")
	if err := h.licenseRepo.ResetHWID(c.Request.Context(), licID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Hardware lock reset successfully"})
}

func (h *DashboardHandler) UpdateLicenseStatus(c *gin.Context) {
	licID := c.Param("lic_id")
	var req struct {
		Status string  `json:"status" binding:"required"`
		Reason *string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.licenseRepo.SetStatus(c.Request.Context(), licID, req.Status, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "License status updated successfully"})
}

func (h *DashboardHandler) DeleteLicense(c *gin.Context) {
	licID := c.Param("lic_id")
	if err := h.licenseRepo.Delete(c.Request.Context(), licID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "License deleted successfully"})
}

func (h *DashboardHandler) ExportLicensesCSV(c *gin.Context) {
	appID := c.Param("id")
	licenses, _, err := h.licenseRepo.ListByApp(c.Request.Context(), appID, "all", "", 10000, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	csvData := h.licenseEng.FormatKeysCSV(licenses)
	c.Header("Content-Disposition", "attachment; filename=licenses.csv")
	c.Data(http.StatusOK, "text/csv", []byte(csvData))
}

// ---------------------------------------------------------------------------
// END-USERS (MODE B)
// ---------------------------------------------------------------------------

func (h *DashboardHandler) ListUsers(c *gin.Context) {
	appID := c.Param("id")
	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	users, total, err := h.userRepo.ListByApp(c.Request.Context(), appID, search, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if users == nil {
		users = []models.AppUser{}
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *DashboardHandler) BanUser(c *gin.Context) {
	userID := c.Param("user_id")
	var req struct {
		IsBanned bool    `json:"is_banned"`
		Reason   *string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.userRepo.SetBan(c.Request.Context(), userID, req.IsBanned, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User moderation state updated"})
}

func (h *DashboardHandler) DeleteUser(c *gin.Context) {
	userID := c.Param("user_id")
	if err := h.userRepo.Delete(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// ---------------------------------------------------------------------------
// REMOTE VARIABLES
// ---------------------------------------------------------------------------

func (h *DashboardHandler) ListVariables(c *gin.Context) {
	appID := c.Param("id")
	vars, err := h.varRepo.ListByApp(c.Request.Context(), appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if vars == nil {
		vars = []models.Variable{}
	}
	c.JSON(http.StatusOK, vars)
}

func (h *DashboardHandler) SaveVariable(c *gin.Context) {
	appID := c.Param("id")
	var req struct {
		VarKey       string `json:"var_key" binding:"required"`
		VarValue     string `json:"var_value" binding:"required"`
		MinTierLevel int    `json:"min_tier_level"`
		IsSecret     bool   `json:"is_secret"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	v := &models.Variable{
		AppID:        appID,
		VarKey:       req.VarKey,
		VarValue:     req.VarValue,
		MinTierLevel: req.MinTierLevel,
		IsSecret:     req.IsSecret,
	}

	if err := h.varRepo.Create(c.Request.Context(), v); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, v)
}

func (h *DashboardHandler) DeleteVariable(c *gin.Context) {
	varID := c.Param("var_id")
	if err := h.varRepo.Delete(c.Request.Context(), varID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Variable deleted successfully"})
}

// ---------------------------------------------------------------------------
// CLOUD FILES
// ---------------------------------------------------------------------------

func (h *DashboardHandler) ListFiles(c *gin.Context) {
	appID := c.Param("id")
	files, err := h.fileRepo.ListByApp(c.Request.Context(), appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if files == nil {
		files = []models.File{}
	}
	c.JSON(http.StatusOK, files)
}

func (h *DashboardHandler) CreateFile(c *gin.Context) {
	appID := c.Param("id")
	var req struct {
		FileName     string `json:"file_name" binding:"required"`
		R2StorageKey string `json:"r2_storage_key" binding:"required"`
		SHA256Hash   string `json:"sha256_hash" binding:"required"`
		FileSizeBytes int64 `json:"file_size_bytes"`
		MinTierLevel int    `json:"min_tier_level"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	f := &models.File{
		AppID:         appID,
		FileName:      req.FileName,
		R2StorageKey:  req.R2StorageKey,
		SHA256Hash:    req.SHA256Hash,
		FileSizeBytes: req.FileSizeBytes,
		MinTierLevel:  req.MinTierLevel,
	}

	if err := h.fileRepo.Create(c.Request.Context(), f); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, f)
}

func (h *DashboardHandler) DeleteFile(c *gin.Context) {
	fileID := c.Param("file_id")
	if err := h.fileRepo.Delete(c.Request.Context(), fileID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
}

// ---------------------------------------------------------------------------
// SECURITY & AUDIT LOGS
// ---------------------------------------------------------------------------

func (h *DashboardHandler) ListLogs(c *gin.Context) {
	appID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	logs, err := h.logRepo.ListByApp(c.Request.Context(), appID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if logs == nil {
		logs = []models.SecurityLog{}
	}
	c.JSON(http.StatusOK, logs)
}

// ---------------------------------------------------------------------------
// RESELLERS
// ---------------------------------------------------------------------------

func (h *DashboardHandler) ListResellers(c *gin.Context) {
	appID := c.Param("id")
	resellers, err := h.resellerRepo.ListByApp(c.Request.Context(), appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if resellers == nil {
		resellers = []models.Reseller{}
	}
	c.JSON(http.StatusOK, resellers)
}

func (h *DashboardHandler) CreateReseller(c *gin.Context) {
	appID := c.Param("id")
	userID := c.GetString("user_id")

	var req struct {
		Username     string `json:"username" binding:"required"`
		Password     string `json:"password" binding:"required,min=6"`
		Credits      int    `json:"credits"`
		CanResetHWID bool   `json:"can_reset_hwid"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, _ := crypto.HashPassword(req.Password)
	res := &models.Reseller{
		DeveloperID:  userID,
		AppID:        appID,
		Username:     req.Username,
		PasswordHash: hash,
		Credits:      req.Credits,
		CanResetHWID: req.CanResetHWID,
		IsActive:     true,
	}

	if err := h.resellerRepo.Create(c.Request.Context(), res); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Reseller username already exists"})
		return
	}

	c.JSON(http.StatusCreated, res)
}

func (h *DashboardHandler) AdjustResellerCredits(c *gin.Context) {
	resellerID := c.Param("reseller_id")
	var req struct {
		CreditsToAdd int `json:"credits_to_add" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.resellerRepo.AddCredits(c.Request.Context(), resellerID, req.CreditsToAdd); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Credits updated successfully"})
}
