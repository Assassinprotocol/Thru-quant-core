package api

import (
	"encoding/base64"
	"testing"
)

func BenchmarkDecodeOracleAccountBytes(b *testing.B) {
	raw, err := base64.StdEncoding.DecodeString(realAlphanetBase64)
	if err != nil {
		b.Fatalf("failed decoding test base64 payload: %v", err)
	}

	nowSec := uint32(1791968301)
	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		state, err := DecodeOracleAccountBytes(raw, nowSec)
		if err != nil || state == nil {
			b.Fatalf("benchmark decode failed: %v", err)
		}
	}
}

func BenchmarkDecodeOracleAccountBase64(b *testing.B) {
	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		state, err := DecodeOracleAccountBase64(realAlphanetBase64)
		if err != nil || state == nil {
			b.Fatalf("benchmark base64 decode failed: %v", err)
		}
	}
}
