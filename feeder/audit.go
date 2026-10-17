package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

var auditMu sync.Mutex

type AuditLogEntry struct {
	Timestamp  string `json:"timestamp"`
	Action     string `json:"action"`
	Signer     string `json:"signer"`
	Program    string `json:"program"`
	Account    string `json:"account"`
	PayloadHex string `json:"payload_hex"`
	Status     string `json:"status"`
	Details    string `json:"details,omitempty"`
}

func recordOperatorAudit(auditFilePath, action, signer, program, account, payloadHex, status, details string) error {
	auditMu.Lock()
	defer auditMu.Unlock()

	entry := AuditLogEntry{
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Action:     action,
		Signer:     signer,
		Program:    program,
		Account:    account,
		PayloadHex: payloadHex,
		Status:     status,
		Details:    details,
	}

	bytes, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	f, err := os.OpenFile(auditFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("failed opening audit log %s: %w", auditFilePath, err)
	}
	defer f.Close()

	if _, err := f.Write(append(bytes, '\n')); err != nil {
		return fmt.Errorf("failed writing audit log: %w", err)
	}
	return nil
}
