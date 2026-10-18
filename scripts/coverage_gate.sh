#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."
cd "${ROOT_DIR}"

echo "=== [1/2] Evaluating C Contract & Math Code Coverage ==="

# Clean stale coverage artifacts
rm -f tests/*.gcda tests/*.gcno src/*.gcda src/*.gcno *.gcov tests/cov_*

# Build test suites with coverage instrumentation
gcc -O0 -g -fprofile-arcs -ftest-coverage -Iinclude -Isrc tests/test_math_checked.c src/thru_math.c -lm -o tests/cov_math_checked
gcc -O0 -g -fprofile-arcs -ftest-coverage -Iinclude -Isrc tests/test_contracts.c src/thru_math.c -lm -o tests/cov_contracts

# Execute instrumented suites
./tests/cov_math_checked >/dev/null
./tests/cov_contracts >/dev/null

echo "--------------------------------------------------------"
printf "%-25s %-15s %-10s\n" "Source File" "Line Coverage" "Status"
echo "--------------------------------------------------------"

FAILURES=0

check_file_coverage() {
    local src_file="$1"
    local pct="$2"
    local min_pct="$3"

    local int_pct
    int_pct=$(echo "${pct}" | cut -d'.' -f1)

    if [ "${int_pct}" -ge "${min_pct}" ]; then
        printf "%-25s %s%% (>= %d%%)   [PASS]\n" "${src_file}" "${pct}" "${min_pct}"
        return 0
    else
        printf "%-25s %s%% (< %d%%)    [FAIL]\n" "${src_file}" "${pct}" "${min_pct}"
        return 1
    fi
}

# 1. thru_math.c coverage
gcov_math_output=$(gcov -o tests/cov_math_checked-thru_math src/thru_math.c 2>/dev/null || true)
math_pct=$(echo "${gcov_math_output}" | grep -A 1 "File 'src/thru_math.c'" | grep -E "(Lines executed|Baris dijalankan):" | grep -oE "[0-9]+\.[0-9]+" | head -n 1 || echo "0.0")
check_file_coverage "src/thru_math.c" "${math_pct}" 85 || FAILURES=$((FAILURES + 1))

# 2. market_oracle.c coverage
gcov_contracts_output=$(gcov -o tests/cov_contracts-test_contracts tests/test_contracts.c 2>/dev/null || true)
oracle_pct=$(echo "${gcov_contracts_output}" | grep -A 1 "File 'src/market_oracle.c'" | grep -E "(Lines executed|Baris dijalankan):" | grep -oE "[0-9]+\.[0-9]+" | head -n 1 || echo "0.0")
check_file_coverage "src/market_oracle.c" "${oracle_pct}" 85 || FAILURES=$((FAILURES + 1))

# 3. clob_engine.c coverage
clob_pct=$(echo "${gcov_contracts_output}" | grep -A 1 "File 'src/clob_engine.c'" | grep -E "(Lines executed|Baris dijalankan):" | grep -oE "[0-9]+\.[0-9]+" | head -n 1 || echo "0.0")
check_file_coverage "src/clob_engine.c" "${clob_pct}" 85 || FAILURES=$((FAILURES + 1))

echo "--------------------------------------------------------"

# Clean up binaries and gcov files
rm -f tests/cov_* tests/*.gcda tests/*.gcno src/*.gcda src/*.gcno *.gcov

if [ "${FAILURES}" -gt 0 ]; then
    echo "FAIL: Code coverage gate failed with ${FAILURES} violation(s)." >&2
    exit 1
fi
echo "  [OK] All C core contract sources satisfy coverage gates."

echo "=== [2/2] Evaluating Go Backend Coverage (API & Quorum Feeder) ==="
go test -cover ./api ./feeder/...

echo "=== Code Coverage Gate Succeeded ==="
exit 0
