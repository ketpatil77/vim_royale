package auth

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"vim_royale/backend/config"
	database "vim_royale/backend/db"

	"github.com/gin-gonic/gin"
)

var gitHubOAuthConfig = &oauth2Config{
	ClientID:     config.GitHubClientID,
	ClientSecret: config.GitHubClientSecret,
	Scopes:       []string{"user:email"},
	AuthURL:      "https://github.com/login/oauth/authorize",
	TokenURL:     "https://github.com/login/oauth/access_token",
}

type oauth2Config struct {
	ClientID     string
	ClientSecret string
	Scopes       []string
	AuthURL      string
	TokenURL     string
}

func (c *oauth2Config) AuthCodeURL(state string) string {
	scopes := strings.Join(c.Scopes, "+")
	return c.AuthURL + "?client_id=" + c.ClientID + "&scope=" + scopes + "&state=" + state
}

func getOAuthConfig() *oauth2Config {
	if config.GitHubClientID != "" {
		return &oauth2Config{
			ClientID:     config.GitHubClientID,
			ClientSecret: config.GitHubClientSecret,
			Scopes:       []string{"user:email"},
			AuthURL:      "https://github.com/login/oauth/authorize",
			TokenURL:     "https://github.com/login/oauth/access_token",
		}
	}
	return gitHubOAuthConfig
}

func GitHubLogin(c *gin.Context) {
	cfg := getOAuthConfig()
	url := cfg.AuthCodeURL("state")
	c.Redirect(http.StatusFound, url)
}

func GitHubCallback(c *gin.Context) {
	cfg := getOAuthConfig()

	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code"})
		return
	}

	token, err := exchangeGitHubToken(cfg, code)
	if err != nil {
		log.Printf("GitHub token exchange error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to exchange code"})
		return
	}

	userInfo, err := getGitHubUserInfo(token)
	if err != nil {
		log.Printf("GitHub user info error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user info"})
		return
	}

	email, _ := userInfo["email"].(string)
	login, _ := userInfo["login"].(string)
	name, _ := userInfo["name"].(string)
	avatarURL, _ := userInfo["avatar_url"].(string)

	if email == "" {
		email = login + "@github.local"
	}

	// GitHub returns numeric IDs; handle both float64 and string
	var providerID string
	switch v := userInfo["id"].(type) {
	case float64:
		providerID = fmt.Sprintf("%.0f", v)
	case string:
		providerID = v
	default:
		log.Printf("Unexpected GitHub ID type: %T", userInfo["id"])
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID from GitHub"})
		return
	}

	user, err := database.FindOrCreateUser("github", providerID, email, name, avatarURL)
	if err != nil {
		log.Printf("User creation error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	jwtToken, err := generateJWT(user)
	if err != nil {
		log.Printf("JWT generation error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.Header(
		"Set-Cookie",
		fmt.Sprintf("token=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d", jwtToken, 86400*30),
	)
	c.Redirect(http.StatusFound, config.FrontendURL)
}

func exchangeGitHubToken(cfg *oauth2Config, code string) (string, error) {
	params := url.Values{
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"code":          {code},
	}

	req, err := http.NewRequest("POST", cfg.TokenURL, strings.NewReader(params.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json") // Tell GitHub to respond with JSON

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken      string `json:"access_token"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	if result.Error != "" {
		return "", fmt.Errorf("github oauth error: %s - %s", result.Error, result.ErrorDescription)
	}

	if result.AccessToken == "" {
		return "", fmt.Errorf("received empty access token from GitHub")
	}

	return result.AccessToken, nil
}

func getGitHubUserInfo(accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "vim-royale")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("user info request failed: %w", err)
	}
	defer resp.Body.Close()

	var userInfo map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	// Fetch primary email separately (may not be on the public profile)
	emailReq, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return userInfo, nil // Non-fatal: fall back to profile email
	}
	emailReq.Header.Set("Authorization", "Bearer "+accessToken)
	emailReq.Header.Set("Accept", "application/vnd.github.v3+json")
	emailReq.Header.Set("User-Agent", "vim-royale")

	emailResp, err := http.DefaultClient.Do(emailReq)
	if err != nil {
		return userInfo, nil // Non-fatal: fall back to profile email
	}
	defer emailResp.Body.Close()

	var emails []struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}
	if err := json.NewDecoder(emailResp.Body).Decode(&emails); err != nil {
		return userInfo, nil // Non-fatal: fall back to profile email
	}

	for _, e := range emails {
		if e.Primary && e.Email != "" {
			userInfo["email"] = e.Email
			break
		}
	}

	return userInfo, nil
}
