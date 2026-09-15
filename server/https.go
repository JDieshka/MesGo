package main

import (
"crypto/rand"
"crypto/rsa"
"crypto/tls"
"crypto/x509"
"crypto/x509/pkix"
"encoding/pem"
"log"
"math/big"
"net"
"net/http"
"os"
"strings"
"time"
)

// generateSelfSignedCert generates a self-signed certificate for HTTPS
func generateSelfSignedCert(certFile, keyFile string, domains []string) error {
privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
if err != nil {
return err
}

var ipAddresses []net.IP
var dnsNames []string
for _, domain := range domains {
if ip := net.ParseIP(domain); ip != nil {
ipAddresses = append(ipAddresses, ip)
} else {
dnsNames = append(dnsNames, domain)
}
}

template := x509.Certificate{
SerialNumber: big.NewInt(1),
Subject: pkix.Name{
Organization: []string{"GoTalk"},
CommonName:   "localhost",
},
NotBefore:             time.Now(),
NotAfter:              time.Now().Add(365 * 24 * time.Hour),
KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
BasicConstraintsValid: true,
IPAddresses:           ipAddresses,
DNSNames:              dnsNames,
}

certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
if err != nil {
return err
}

certOut, err := os.Create(certFile)
if err != nil {
return err
}
defer certOut.Close()
pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})

keyOut, err := os.Create(keyFile)
if err != nil {
return err
}
defer keyOut.Close()
privBytes, err := x509.MarshalPKCS8PrivateKey(privateKey)
if err != nil {
return err
}
pem.Encode(keyOut, &pem.Block{Type: "PRIVATE KEY", Bytes: privBytes})

return nil
}

// startHTTPSServer starts HTTPS server with SSL support
func startHTTPSServer(router http.Handler, port string, certFile, keyFile string, useSSL bool) error {
var cert tls.Certificate
var err error

if useSSL && certFile != "" && keyFile != "" {
if _, err := os.Stat(certFile); os.IsNotExist(err) {
log.Printf("🔐 Certificate file not found at %s, generating self-signed...", certFile)
defaultDomains := []string{"localhost", "127.0.0.1"}
if err := generateSelfSignedCert(certFile, keyFile, defaultDomains); err != nil {
return err
}
log.Println("✅ Self-signed certificate generated")
}

cert, err = tls.LoadX509KeyPair(certFile, keyFile)
if err != nil {
return err
}
log.Printf("🔒 Loading SSL certificate from: %s", certFile)
} else {
tempCertFile := "/tmp/gotalk-cert.pem"
tempKeyFile := "/tmp/gotalk-key.pem"

if _, err := os.Stat(tempCertFile); os.IsNotExist(err) {
log.Println("🔐 Generating temporary self-signed certificate...")
defaultDomains := []string{"localhost", "127.0.0.1"}
if err := generateSelfSignedCert(tempCertFile, tempKeyFile, defaultDomains); err != nil {
return err
}
log.Println("✅ Temporary certificate generated")
}

cert, err = tls.LoadX509KeyPair(tempCertFile, tempKeyFile)
if err != nil {
return err
}
log.Println("⚠️  Using temporary self-signed certificate (development)")
}

tlsConfig := &tls.Config{
Certificates: []tls.Certificate{cert},
MinVersion:   tls.VersionTLS12,
}

server := &http.Server{
Addr:      port,
Handler:   router,
TLSConfig: tlsConfig,
}

log.Printf("🔒 HTTPS server starting on port %s", port)
if useSSL {
log.Printf("📡 Available at: https://localhost%s", port)
log.Printf("🔐 Using SSL certificate: %s", certFile)
} else {
log.Printf("📡 Available at: https://localhost%s", port)
log.Printf("⚠️  Browser will show security warning (self-signed)")
}

return server.ListenAndServeTLS("", "")
}

// GetAllowedOrigins returns allowed origins from env
func GetAllowedOrigins() []string {
originsStr := os.Getenv("ALLOWED_ORIGINS")
if originsStr == "" {
return []string{"http://localhost:3000", "http://localhost:5173", "http://localhost:80"}
}

origins := strings.Split(originsStr, ",")
for i, origin := range origins {
origins[i] = strings.TrimSpace(origin)
}
return origins
}

// CheckOrigin creates CORS check function
func CheckOrigin(allowedOrigins []string) func(r *http.Request) bool {
return func(r *http.Request) bool {
origin := r.Header.Get("Origin")
if origin == "" {
return true
}

for _, allowed := range allowedOrigins {
if allowed == "*" {
return true
}
if origin == allowed {
return true
}
if strings.HasPrefix(allowed, "*.") {
domain := allowed[2:]
if strings.HasSuffix(origin, domain) {
return true
}
}
}

log.Printf("⚠️  Blocked CORS request from origin: %s", origin)
return false
}
}
