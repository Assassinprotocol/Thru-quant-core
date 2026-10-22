package main

import (
	"encoding/binary"
	"testing"
)

func TestPriceToFixed8(t *testing.T) {
	cases := []struct {
		input    float64
		expected uint64
	}{
		{0.0, 0},
		{1.0, 100000000},
		{84000.50, 8400050000000},
		{0.00000001, 1},
	}

	for _, c := range cases {
		got := PriceToFixed8(c.input)
		if got != c.expected {
			t.Fatalf("for %f: got %d, expected %d", c.input, got, c.expected)
		}
		recovered := Fixed8ToPrice(got)
		if c.input > 0 && recovered != c.input {
			t.Fatalf("for %f: roundtrip recovered %f", c.input, recovered)
		}
	}
}

func TestBuildV2SubmitPayload(t *testing.T) {
	quotes := map[string]QuoteData{
		"BTCUSDT": {Price: 84000.50, SourceTime: 1700000000},
		"ETHUSDT": {Price: 2600.25, SourceTime: 1700000001},
	}

	payload := BuildV2SubmitPayload(0, 10, 42, quotes)
	if len(payload) == 0 {
		t.Fatal("expected non-empty payload")
	}

	opcode := binary.LittleEndian.Uint32(payload[0:4])
	if opcode != OpcodeV2SubmitPrices {
		t.Fatalf("expected opcode %d, got %d", OpcodeV2SubmitPrices, opcode)
	}

	regIdx := binary.LittleEndian.Uint16(payload[4:6])
	if regIdx != 0 {
		t.Fatalf("expected regIdx 0, got %d", regIdx)
	}

	subIdx := binary.LittleEndian.Uint16(payload[6:8])
	if subIdx != 10 {
		t.Fatalf("expected subIdx 10, got %d", subIdx)
	}

	seq := binary.LittleEndian.Uint64(payload[8:16])
	if seq != 42 {
		t.Fatalf("expected seq 42, got %d", seq)
	}

	count := binary.LittleEndian.Uint32(payload[16:20])
	if count != 2 {
		t.Fatalf("expected count 2, got %d", count)
	}

	expectedLen := 20 + 2*24
	if len(payload) != expectedLen {
		t.Fatalf("expected len %d, got %d", expectedLen, len(payload))
	}
}

func TestBuildV2AggregatePayload(t *testing.T) {
	subIndices := [7]uint16{10, 11, 12, 13, 14, 0, 0}
	payload := BuildV2AggregatePayload(0, 1, 1, subIndices)
	if len(payload) != 26 {
		t.Fatalf("expected len 26, got %d", len(payload))
	}

	opcode := binary.LittleEndian.Uint32(payload[0:4])
	if opcode != OpcodeV2Aggregate {
		t.Fatalf("expected opcode %d, got %d", OpcodeV2Aggregate, opcode)
	}

	symID := binary.LittleEndian.Uint32(payload[8:12])
	if symID != 1 {
		t.Fatalf("expected symID 1, got %d", symID)
	}
}
