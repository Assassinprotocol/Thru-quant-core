package main

import (
	"math/big"
)

func floatToQ64(f float64) (hi uint64, lo uint64) {
	if f <= 0 {
		return 0, 0
	}
	scale := new(big.Int).Lsh(big.NewInt(1), 64)
	val := new(big.Float).Mul(big.NewFloat(f), new(big.Float).SetInt(scale))
	intVal, _ := val.Int(nil)

	loMask := new(big.Int).SetUint64(0xFFFFFFFFFFFFFFFF)
	loBig := new(big.Int).And(intVal, loMask)
	hiBig := new(big.Int).Rsh(intVal, 64)

	return hiBig.Uint64(), loBig.Uint64()
}

func q64ToFloat(hi uint64, lo uint64) float64 {
	hiBig := new(big.Int).Lsh(new(big.Int).SetUint64(hi), 64)
	loBig := new(big.Int).SetUint64(lo)
	full := new(big.Int).Or(hiBig, loBig)

	scale := new(big.Float).SetInt(new(big.Int).Lsh(big.NewInt(1), 64))
	fVal := new(big.Float).Quo(new(big.Float).SetInt(full), scale)
	res, _ := fVal.Float64()
	return res
}
