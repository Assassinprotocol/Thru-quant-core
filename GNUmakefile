BASEDIR:=$(CURDIR)/build
THRU_C_SDK_DIR:=$(HOME)/.thru/sdk/c/thru-sdk
RISCV_TOOLCHAIN_ROOT:=$(HOME)/.thru/sdk/toolchain
CPPFLAGS+=-I$(CURDIR)/include -I$(CURDIR)/src

-include $(THRU_C_SDK_DIR)/thru_c_program.mk

test:
	gcc -O2 -fsanitize=address,undefined -Iinclude -Isrc tests/test_thru_math.c src/thru_math.c -o tests/test_math
	./tests/test_math
	gcc -O2 -fsanitize=address,undefined -Iinclude -Isrc tests/test_contracts.c src/thru_math.c -o tests/test_contracts
	./tests/test_contracts

test-simulation:
	gcc -O2 -fsanitize=address,undefined -Iinclude tests/test_simulation.c src/thru_math.c -o tests/test_simulation
	./tests/test_simulation

test-hardening:
	gcc -O2 -fsanitize=address,undefined -Iinclude -Isrc tests/test_oracle_hardening.c src/thru_math.c -o tests/test_oracle_hardening
	./tests/test_oracle_hardening

test-math-golden:
	gcc -O2 -fsanitize=address,undefined -Iinclude tests/test_math_golden.c src/thru_math.c -o tests/test_math_golden
	./tests/test_math_golden

test-math-checked:
	gcc -O2 -fsanitize=address,undefined -Iinclude -Isrc tests/test_math_checked.c src/thru_math.c -o tests/test_math_checked
	./tests/test_math_checked

fuzz-math:
	gcc -O3 -Iinclude -Isrc tests/fuzz_math_diff.c src/thru_math.c -lm -o tests/fuzz_math_diff
	./tests/fuzz_math_diff 200000
	rm -f tests/fuzz_math_diff

fuzz-contracts:
	gcc -O3 -fsanitize=address,undefined -Iinclude -Isrc tests/fuzz_contracts.c src/thru_math.c -lm -o tests/fuzz_contracts
	./tests/fuzz_contracts 100000
	rm -f tests/fuzz_contracts

lint-c:
	gcc -fsyntax-only -Wall -Wextra -Wshadow -Wconversion -Werror -Iinclude -Isrc src/market_oracle.c src/thru_math.c

lint-clob:
	gcc -fsyntax-only -Wall -Wextra -Wshadow -Wconversion -Werror -Iinclude -Iresearch/clob research/clob/clob_engine.c src/thru_math.c

test-clob:
	gcc -O2 -fsanitize=address,undefined -Iinclude -Iresearch/clob research/clob/test_clob.c src/thru_math.c -o research/clob/test_clob
	./research/clob/test_clob
	rm -f research/clob/test_clob

fuzz-clob:
	gcc -O3 -fsanitize=address,undefined -Iinclude -Iresearch/clob research/clob/fuzz_clob.c src/thru_math.c -lm -o research/clob/fuzz_clob
	./research/clob/fuzz_clob 100000
	rm -f research/clob/fuzz_clob

lint-claims:
	bash scripts/claims_lint.sh

verify-claims:
	bash scripts/verify_onchain_claims.sh

test-api:
	go test -v ./...

build-api:
	go build -o build/thru_oracle_api ./cmd/api

build-feeder:
	go build -o build/feeder ./feeder

build-rv64:
	$(MAKE) bin
	@echo "=== Verifying RISC-V Binary Bounds (< 32 KB) ==="
	@test $$(wc -c < build/thruvm/bin/market_oracle_c.bin) -le 32768 || { echo "market_oracle_c.bin exceeds 32KB"; exit 1; }
	@echo "  [OK] market_oracle_c.bin: $$(wc -c < build/thruvm/bin/market_oracle_c.bin) B"
	@sha256sum build/thruvm/bin/market_oracle_c.bin

run-api: build-api
	./build/thru_oracle_api --port 8080 --static-dir ./visualizer

bench-math:
	gcc -O3 -Iinclude tests/test_math_bench.c src/thru_math.c -o tests/test_bench
	./tests/test_bench
	rm -f tests/test_bench

bench-api:
	go test -bench=. -benchmem ./api

build-sdk:
	cd sdk && ([ -d node_modules ] || npm install --silent) && npm run build

test-sdk:
	node --test sdk/test/*.test.ts

run-example:
	cd examples/quant-agent-consumer && ([ -d node_modules ] || npm install --silent) && node agent.ts --dry-run

all-tests: test test-simulation test-hardening test-math-golden test-math-checked fuzz-math fuzz-contracts lint-c lint-claims verify-claims coverage test-api test-sdk run-example

coverage:
	bash scripts/coverage_gate.sh

clean-tests:
	rm -f tests/test_math tests/test_simulation tests/test_contracts tests/test_bench tests/test_oracle_hardening tests/test_math_golden tests/test_math_checked tests/fuzz_math_diff tests/fuzz_contracts tests/cov_* tests/*.gcda tests/*.gcno src/*.gcda src/*.gcno *.gcov

