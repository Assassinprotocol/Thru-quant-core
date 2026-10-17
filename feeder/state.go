package main

import (
	"strings"
)

type TxResultType int

const (
	TxResultSuccess TxResultType = iota
	TxResultTripped
	TxResultRevert
	TxResultTimeout
	TxResultUnknown
)

func (r TxResultType) String() string {
	switch r {
	case TxResultSuccess:
		return "SUCCESS"
	case TxResultTripped:
		return "CIRCUIT_BREAKER_TRIPPED"
	case TxResultRevert:
		return "REVERT"
	case TxResultTimeout:
		return "TIMEOUT"
	default:
		return "UNKNOWN"
	}
}

// ClassifyTxOutput parses stdout/stderr of thru txn execute or RPC response
func ClassifyTxOutput(output string, err error) TxResultType {
	if err == nil && !strings.Contains(strings.ToLower(output), "error") && !strings.Contains(strings.ToLower(output), "revert") {
		return TxResultSuccess
	}
	outLower := strings.ToLower(output)
	if strings.Contains(outLower, "0x200b") || strings.Contains(outLower, "8203") ||
		strings.Contains(outLower, "circuit breaker") || strings.Contains(outLower, "0x2007") ||
		strings.Contains(outLower, "8199") || strings.Contains(outLower, "price limit exceeded") {
		return TxResultTripped
	}
	if strings.Contains(outLower, "context deadline exceeded") || strings.Contains(outLower, "timeout") {
		return TxResultTimeout
	}
	if strings.Contains(outLower, "revert") || strings.Contains(outLower, "failed") {
		return TxResultRevert
	}
	return TxResultUnknown
}
