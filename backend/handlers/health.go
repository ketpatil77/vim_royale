package handlers

import (
	"github.com/gin-gonic/gin"
)

func HealthzHandler(c *gin.Context) {
	c.String(200, "ok")
}