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
	"time"
)

// generateSelfSignedCert generates a self-signed certificate for HTTPS
func generateSelfSignedCert(certFile, keyFile string) error {
	// Generate private key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}

	// Create certificate template
	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"GoTalk"},
			CommonName:   "localhost",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(365 * 24 * time.Hour), // 1 year
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("192.168.1.156")},
		DNSNames:              []string{"localhost"},
	}

	// Create certificate
	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
	if err != nil {
		return err
	}

	// Write certificate to file
	certOut, err := os.Create(certFile)
	if err != nil {
		return err
	}
	defer certOut.Close()
	pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	// Write private key to file
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

// startHTTPSServer starts HTTPS server with self-signed certificate
func startHTTPSServer(router http.Handler, port string) error {
	certFile := "cert.pem"
	keyFile := "key.pem"

	// Generate certificate if it doesn't exist
	if _, err := os.Stat(certFile); os.IsNotExist(err) {
		log.Println("🔐 Generating self-signed certificate...")
		if err := generateSelfSignedCert(certFile, keyFile); err != nil {
			return err
		}
		log.Println("✅ Certificate generated successfully")
	}

	// Load certificate
	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return err
	}

	// Configure TLS
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}

	// Create HTTPS server
	server := &http.Server{
		Addr:      port,
		Handler:   router,
		TLSConfig: tlsConfig,
	}

	log.Printf("🔒 HTTPS server starting on port %s", port)
	log.Printf("📡 Available at:")
	log.Printf("   Local:    https://localhost%s", port)
	log.Printf("   Network:  https://192.168.1.156%s", port)
	log.Printf("")
	log.Printf("⚠️  Browser will show security warning (self-signed certificate)")
	log.Printf("   Click 'Advanced' -> 'Proceed to localhost (unsafe)' to continue")

	return server.ListenAndServeTLS("", "")
}
