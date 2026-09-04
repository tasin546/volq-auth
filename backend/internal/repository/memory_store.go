package repository

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/volq-auth/volq-auth/internal/models"
)

type MemoryStore struct {
	mu            sync.RWMutex
	filePath      string
	Developers    map[string]*models.Developer
	Applications  map[string]*models.Application
	Subscriptions map[string][]*models.Subscription
	Licenses      map[string]*models.License
	Users         map[string]*models.AppUser
	Variables     map[string]*models.Variable
	Files         map[string]*models.File
	Logs          []*models.SecurityLog
	Resellers     map[string]*models.Reseller
}

type persistedData struct {
	Developers    map[string]*models.Developer      `json:"developers"`
	Applications  map[string]*models.Application    `json:"applications"`
	Subscriptions map[string][]*models.Subscription `json:"subscriptions"`
	Licenses      map[string]*models.License        `json:"licenses"`
	Users         map[string]*models.AppUser        `json:"users"`
	Variables     map[string]*models.Variable       `json:"variables"`
	Files         map[string]*models.File           `json:"files"`
	Logs          []*models.SecurityLog             `json:"logs"`
	Resellers     map[string]*models.Reseller       `json:"resellers"`
}

func NewMemoryStore(filePath string) *MemoryStore {
	store := &MemoryStore{
		filePath:      filePath,
		Developers:    make(map[string]*models.Developer),
		Applications:  make(map[string]*models.Application),
		Subscriptions: make(map[string][]*models.Subscription),
		Licenses:      make(map[string]*models.License),
		Users:         make(map[string]*models.AppUser),
		Variables:     make(map[string]*models.Variable),
		Files:         make(map[string]*models.File),
		Logs:          make([]*models.SecurityLog, 0),
		Resellers:     make(map[string]*models.Reseller),
	}

	store.loadFromFile()
	return store
}

func (s *MemoryStore) saveToFile() {
	if s.filePath == "" {
		return
	}
	data := persistedData{
		Developers:    s.Developers,
		Applications:  s.Applications,
		Subscriptions: s.Subscriptions,
		Licenses:      s.Licenses,
		Users:         s.Users,
		Variables:     s.Variables,
		Files:         s.Files,
		Logs:          s.Logs,
		Resellers:     s.Resellers,
	}
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err == nil {
		_ = os.WriteFile(s.filePath, bytes, 0644)
	}
}

func (s *MemoryStore) loadFromFile() {
	if s.filePath == "" {
		return
	}
	bytes, err := os.ReadFile(s.filePath)
	if err != nil {
		return
	}
	var data persistedData
	if err := json.Unmarshal(bytes, &data); err == nil {
		if data.Developers != nil {
			s.Developers = data.Developers
		}
		if data.Applications != nil {
			s.Applications = data.Applications
		}
		if data.Subscriptions != nil {
			s.Subscriptions = data.Subscriptions
		}
		if data.Licenses != nil {
			s.Licenses = data.Licenses
		}
		if data.Users != nil {
			s.Users = data.Users
		}
		if data.Variables != nil {
			s.Variables = data.Variables
		}
		if data.Files != nil {
			s.Files = data.Files
		}
		if data.Logs != nil {
			s.Logs = data.Logs
		}
		if data.Resellers != nil {
			s.Resellers = data.Resellers
		}
	}
}

// Sub-adapters implementing specific repository interfaces
type MemoryAppRepo struct{ *MemoryStore }
type MemoryLicenseRepo struct{ *MemoryStore }
type MemoryUserRepo struct{ *MemoryStore }
type MemoryVarRepo struct{ *MemoryStore }
type MemoryFileRepo struct{ *MemoryStore }
type MemoryLogRepo struct{ *MemoryStore }
type MemoryResellerRepo struct{ *MemoryStore }

func (s *MemoryStore) AppRepo() AppRepository           { return &MemoryAppRepo{s} }
func (s *MemoryStore) LicenseRepo() LicenseRepository   { return &MemoryLicenseRepo{s} }
func (s *MemoryStore) UserRepo() UserRepository         { return &MemoryUserRepo{s} }
func (s *MemoryStore) VarRepo() VariableRepository      { return &MemoryVarRepo{s} }
func (s *MemoryStore) FileRepo() FileRepository         { return &MemoryFileRepo{s} }
func (s *MemoryStore) LogRepo() LogRepository           { return &MemoryLogRepo{s} }
func (s *MemoryStore) ResellerRepo() ResellerRepository { return &MemoryResellerRepo{s} }

// ---------------------------------------------------------------------------
// APPLICATION REPOSITORY
// ---------------------------------------------------------------------------

func (r *MemoryAppRepo) Create(ctx context.Context, app *models.Application) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if app.ID == "" {
		app.ID = uuid.New().String()
	}
	app.CreatedAt = time.Now()
	app.UpdatedAt = time.Now()
	r.Applications[app.ID] = app
	r.saveToFile()
	return nil
}

func (r *MemoryAppRepo) GetByID(ctx context.Context, id string) (*models.Application, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if app, ok := r.Applications[id]; ok {
		cp := *app
		return &cp, nil
	}
	return nil, nil
}

func (r *MemoryAppRepo) ListByDeveloper(ctx context.Context, developerID string) ([]models.Application, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var apps []models.Application
	for _, app := range r.Applications {
		if app.DeveloperID == developerID {
			apps = append(apps, *app)
		}
	}
	return apps, nil
}

func (r *MemoryAppRepo) Update(ctx context.Context, app *models.Application) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.Applications[app.ID]; ok {
		app.UpdatedAt = time.Now()
		r.Applications[app.ID] = app
		r.saveToFile()
		return nil
	}
	return errors.New("application not found")
}

func (r *MemoryAppRepo) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Applications, id)
	r.saveToFile()
	return nil
}

func (r *MemoryAppRepo) CreateDeveloper(ctx context.Context, dev *models.Developer) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, d := range r.Developers {
		if d.Username == dev.Username {
			if d.PasswordHash == "" && dev.PasswordHash != "" {
				d.PasswordHash = dev.PasswordHash
				r.saveToFile()
				return nil
			}
			return errors.New("developer already exists")
		}
		if d.Email == dev.Email {
			return errors.New("developer already exists")
		}
	}

	if dev.ID == "" {
		dev.ID = uuid.New().String()
	}
	dev.CreatedAt = time.Now()
	dev.UpdatedAt = time.Now()
	r.Developers[dev.ID] = dev
	r.saveToFile()
	return nil
}

func (r *MemoryAppRepo) GetDeveloperByUsername(ctx context.Context, username string) (*models.Developer, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, d := range r.Developers {
		if d.Username == username || d.Email == username {
			cp := *d
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *MemoryAppRepo) GetDeveloperByID(ctx context.Context, id string) (*models.Developer, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if d, ok := r.Developers[id]; ok {
		cp := *d
		return &cp, nil
	}
	return nil, nil
}

// ---------------------------------------------------------------------------
// LICENSE REPOSITORY
// ---------------------------------------------------------------------------

func (r *MemoryLicenseRepo) Create(ctx context.Context, lic *models.License) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if lic.ID == "" {
		lic.ID = uuid.New().String()
	}
	lic.CreatedAt = time.Now()
	lic.Status = models.LicenseStatusUnactivated
	r.Licenses[lic.ID] = lic
	r.saveToFile()
	return nil
}

func (r *MemoryLicenseRepo) BulkCreate(ctx context.Context, licenses []*models.License) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	for _, lic := range licenses {
		if lic.ID == "" {
			lic.ID = uuid.New().String()
		}
		lic.CreatedAt = now
		r.Licenses[lic.ID] = lic
	}
	r.saveToFile()
	return nil
}

func (r *MemoryLicenseRepo) GetByKey(ctx context.Context, appID, key string) (*models.License, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, l := range r.Licenses {
		if l.AppID == appID && l.LicenseKey == key {
			cp := *l
			cp.SubscriptionName = "Standard"
			cp.TierLevel = 1
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *MemoryLicenseRepo) GetByID(ctx context.Context, id string) (*models.License, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if l, ok := r.Licenses[id]; ok {
		cp := *l
		return &cp, nil
	}
	return nil, nil
}

func (r *MemoryLicenseRepo) ListByApp(ctx context.Context, appID string, status string, search string, limit, offset int) ([]models.License, int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var matched []models.License
	for _, l := range r.Licenses {
		if l.AppID != appID {
			continue
		}
		if status != "" && status != "all" && l.Status != status {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(l.LicenseKey), strings.ToLower(search)) && !strings.Contains(strings.ToLower(l.Note), strings.ToLower(search)) {
			continue
		}
		cp := *l
		cp.SubscriptionName = "Standard"
		cp.TierLevel = 1
		matched = append(matched, cp)
	}

	total := len(matched)
	if offset > total {
		return []models.License{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return matched[offset:end], total, nil
}

func (r *MemoryLicenseRepo) Activate(ctx context.Context, id string, hwid string, expiresAt *time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if lic, ok := r.Licenses[id]; ok {
		lic.Status = models.LicenseStatusActive
		lic.HWIDHash = &hwid
		now := time.Now()
		lic.ActivatedAt = &now
		lic.ExpiresAt = expiresAt
		r.saveToFile()
		return nil
	}
	return errors.New("license not found")
}

func (r *MemoryLicenseRepo) ResetHWID(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if lic, ok := r.Licenses[id]; ok {
		lic.HWIDHash = nil
		lic.HWIDList = []string{}
		now := time.Now()
		lic.LastHWIDReset = &now
		r.saveToFile()
		return nil
	}
	return errors.New("license not found")
}

func (r *MemoryLicenseRepo) SetStatus(ctx context.Context, id string, status string, reason *string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if lic, ok := r.Licenses[id]; ok {
		lic.Status = status
		lic.BannedReason = reason
		r.saveToFile()
		return nil
	}
	return errors.New("license not found")
}

func (r *MemoryLicenseRepo) Extend(ctx context.Context, id string, additionalSeconds int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if lic, ok := r.Licenses[id]; ok {
		lic.DurationSeconds += additionalSeconds
		if lic.ExpiresAt != nil {
			newExp := lic.ExpiresAt.Add(time.Duration(additionalSeconds) * time.Second)
			lic.ExpiresAt = &newExp
		}
		r.saveToFile()
		return nil
	}
	return errors.New("license not found")
}

func (r *MemoryLicenseRepo) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Licenses, id)
	r.saveToFile()
	return nil
}

func (r *MemoryLicenseRepo) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if sub.ID == "" {
		sub.ID = uuid.New().String()
	}
	sub.CreatedAt = time.Now()
	r.Subscriptions[sub.AppID] = append(r.Subscriptions[sub.AppID], sub)
	r.saveToFile()
	return nil
}

func (r *MemoryLicenseRepo) ListSubscriptionsByApp(ctx context.Context, appID string) ([]models.Subscription, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	subs := r.Subscriptions[appID]
	res := make([]models.Subscription, len(subs))
	for i, sub := range subs {
		res[i] = *sub
	}
	return res, nil
}

// ---------------------------------------------------------------------------
// USER REPOSITORY (MODE B)
// ---------------------------------------------------------------------------

func (r *MemoryUserRepo) Create(ctx context.Context, user *models.AppUser) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, u := range r.Users {
		if u.AppID == user.AppID && u.Username == user.Username {
			return errors.New("username already registered")
		}
	}

	if user.ID == "" {
		user.ID = uuid.New().String()
	}
	user.CreatedAt = time.Now()
	r.Users[user.ID] = user
	r.saveToFile()
	return nil
}

func (r *MemoryUserRepo) GetByUsername(ctx context.Context, appID, username string) (*models.AppUser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, u := range r.Users {
		if u.AppID == appID && u.Username == username {
			cp := *u
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *MemoryUserRepo) ListByApp(ctx context.Context, appID string, search string, limit, offset int) ([]models.AppUser, int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var matched []models.AppUser
	for _, u := range r.Users {
		if u.AppID != appID {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(u.Username), strings.ToLower(search)) {
			continue
		}
		matched = append(matched, *u)
	}

	total := len(matched)
	if offset > total {
		return []models.AppUser{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return matched[offset:end], total, nil
}

func (r *MemoryUserRepo) UpdateLogin(ctx context.Context, id string, ip string, hwid string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if u, ok := r.Users[id]; ok {
		u.IPAddress = &ip
		if u.HWIDHash == nil {
			u.HWIDHash = &hwid
		}
		now := time.Now()
		u.LastLoginAt = &now
		r.saveToFile()
	}
	return nil
}

func (r *MemoryUserRepo) SetBan(ctx context.Context, id string, isBanned bool, reason *string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if u, ok := r.Users[id]; ok {
		u.IsBanned = isBanned
		u.BanReason = reason
		r.saveToFile()
	}
	return nil
}

func (r *MemoryUserRepo) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Users, id)
	r.saveToFile()
	return nil
}

// ---------------------------------------------------------------------------
// VARIABLE REPOSITORY
// ---------------------------------------------------------------------------

func (r *MemoryVarRepo) Create(ctx context.Context, v *models.Variable) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, existing := range r.Variables {
		if existing.AppID == v.AppID && existing.VarKey == v.VarKey {
			existing.VarValue = v.VarValue
			existing.MinTierLevel = v.MinTierLevel
			existing.IsSecret = v.IsSecret
			r.saveToFile()
			return nil
		}
	}

	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	v.CreatedAt = time.Now()
	r.Variables[v.ID] = v
	r.saveToFile()
	return nil
}

func (r *MemoryVarRepo) GetByKey(ctx context.Context, appID, varKey string) (*models.Variable, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, v := range r.Variables {
		if v.AppID == appID && v.VarKey == varKey {
			cp := *v
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *MemoryVarRepo) ListByApp(ctx context.Context, appID string) ([]models.Variable, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []models.Variable
	for _, v := range r.Variables {
		if v.AppID == appID {
			list = append(list, *v)
		}
	}
	return list, nil
}

func (r *MemoryVarRepo) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Variables, id)
	r.saveToFile()
	return nil
}

// ---------------------------------------------------------------------------
// FILE REPOSITORY
// ---------------------------------------------------------------------------

func (r *MemoryFileRepo) Create(ctx context.Context, f *models.File) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	f.CreatedAt = time.Now()
	r.Files[f.ID] = f
	r.saveToFile()
	return nil
}

func (r *MemoryFileRepo) GetByName(ctx context.Context, appID, fileName string) (*models.File, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, f := range r.Files {
		if f.AppID == appID && f.FileName == fileName {
			cp := *f
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *MemoryFileRepo) ListByApp(ctx context.Context, appID string) ([]models.File, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []models.File
	for _, f := range r.Files {
		if f.AppID == appID {
			list = append(list, *f)
		}
	}
	return list, nil
}

func (r *MemoryFileRepo) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Files, id)
	r.saveToFile()
	return nil
}

// ---------------------------------------------------------------------------
// LOG REPOSITORY
// ---------------------------------------------------------------------------

func (r *MemoryLogRepo) Create(ctx context.Context, log *models.SecurityLog) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	log.ID = int64(len(r.Logs) + 1)
	log.CreatedAt = time.Now()
	r.Logs = append([]*models.SecurityLog{log}, r.Logs...)
	r.saveToFile()
	return nil
}

func (r *MemoryLogRepo) ListByApp(ctx context.Context, appID string, limit int) ([]models.SecurityLog, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var matched []models.SecurityLog
	for _, l := range r.Logs {
		if l.AppID == appID {
			matched = append(matched, *l)
			if len(matched) >= limit {
				break
			}
		}
	}
	return matched, nil
}

// ---------------------------------------------------------------------------
// RESELLER REPOSITORY
// ---------------------------------------------------------------------------

func (r *MemoryResellerRepo) Create(ctx context.Context, res *models.Reseller) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if res.ID == "" {
		res.ID = uuid.New().String()
	}
	res.CreatedAt = time.Now()
	r.Resellers[res.ID] = res
	r.saveToFile()
	return nil
}

func (r *MemoryResellerRepo) GetByUsername(ctx context.Context, username string) (*models.Reseller, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, res := range r.Resellers {
		if res.Username == username {
			cp := *res
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *MemoryResellerRepo) GetByID(ctx context.Context, id string) (*models.Reseller, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if res, ok := r.Resellers[id]; ok {
		cp := *res
		return &cp, nil
	}
	return nil, nil
}

func (r *MemoryResellerRepo) ListByApp(ctx context.Context, appID string) ([]models.Reseller, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []models.Reseller
	for _, res := range r.Resellers {
		if res.AppID == appID {
			list = append(list, *res)
		}
	}
	return list, nil
}

func (r *MemoryResellerRepo) DeductCredits(ctx context.Context, resellerID string, creditsToDeduct int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if res, ok := r.Resellers[resellerID]; ok {
		if res.Credits >= creditsToDeduct {
			res.Credits -= creditsToDeduct
			r.saveToFile()
			return true, nil
		}
		return false, nil
	}
	return false, errors.New("reseller not found")
}

func (r *MemoryResellerRepo) AddCredits(ctx context.Context, resellerID string, creditsToAdd int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if res, ok := r.Resellers[resellerID]; ok {
		res.Credits += creditsToAdd
		r.saveToFile()
		return nil
	}
	return errors.New("reseller not found")
}

func (r *MemoryResellerRepo) LogAction(ctx context.Context, resellerID, appID, action, licenseKey string, creditsUsed int) error {
	return nil
}
