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
	gcc -fsyntax-only -Wall -Wextra -Wshadow -Wconversion -Werror -Iinclude -Isrc -Isrc/v2 src/v2/aggregation_math.c src/v2/oracle_v2.c

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

test-deploy:
	python3 tests/test_deploy_and_reset.py

test-runtime-assumptions:
	python3 tests/test_runtime_assumptions.py

test-observability:
	python3 tests/test_observability.py

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
	@test $$(wc -c < build/thruvm/bin/oracle_v2_c.bin) -le 32768 || { echo "oracle_v2_c.bin exceeds 32KB"; exit 1; }
	@echo "  [OK] oracle_v2_c.bin: $$(wc -c < build/thruvm/bin/oracle_v2_c.bin) B"
	@sha256sum build/thruvm/bin/oracle_v2_c.bin

run-api: build-api
	./build/thru_oracle_api --port 8080 --static-dir ./visualizer

bench-math:
	gcc -O3 -Iinclude tests/test_math_bench.c src/thru_math.c -o tests/test_bench
	./tests/test_bench
	rm -f tests/test_bench

bench-api:
	go test -bench=. -benchmem ./api

codegen-abi:
	thru abi codegen --files src/market_oracle.abi.yaml --language typescript --output sdk/src/generated

build-sdk:
	cd sdk && ([ -d node_modules ] || npm install --silent) && npm run build

test-sdk:
	node --test sdk/test/*.test.ts

run-example:
	cd examples/quant-agent-consumer && ([ -d node_modules ] || npm install --silent) && node agent.ts --dry-run

test-v2-math:
	gcc -O2 -fsanitize=address,undefined -Isrc/v2 tests/test_aggregation_v2.c src/v2/aggregation_math.c -o tests/test_aggregation_v2
	./tests/test_aggregation_v2
	rm -f tests/test_aggregation_v2

test-v2-golden:
	gcc -O2 -fsanitize=address,undefined -Isrc/v2 -Itests tests/test_v2_golden.c src/v2/aggregation_math.c -o tests/test_v2_golden
	./tests/test_v2_golden
	rm -f tests/test_v2_golden

bench-v2-math:
	gcc -O3 -fsanitize=address,undefined -Isrc/v2 tests/bench_aggregation.c src/v2/aggregation_math.c -o tests/bench_agg
	./tests/bench_agg
	rm -f tests/bench_agg

test-v2-contracts:
	gcc -O2 -fsanitize=address,undefined -Iinclude -Isrc -Isrc/v2 tests/test_oracle_v2_contracts.c src/v2/aggregation_math.c -o tests/test_oracle_v2_contracts
	./tests/test_oracle_v2_contracts
	rm -f tests/test_oracle_v2_contracts

fuzz-v2-contracts:
	gcc -O3 -fsanitize=address,undefined -Iinclude -Isrc -Isrc/v2 tests/fuzz_oracle_v2.c src/v2/aggregation_math.c -o tests/fuzz_oracle_v2
	./tests/fuzz_oracle_v2 50000
	rm -f tests/fuzz_oracle_v2

generate-v2-fixtures:
	python3 tests/generate_v2_fixtures.py

test-v2-shadow-parity:
	python3 tests/test_v1_v2_shadow_parity.py

test-indexer:
	node --test indexer/test/*.test.ts

test-gateway:
	node --test gateway/test/*.test.ts

build-web:
	cd web && npm run build

test-web:
	cd web && npm test

build-mcp:
	cd mcp && npm run build

test-mcp:
	node --test mcp/test/*.test.ts

test-time-to-first-price:
	node --test tests/test_time_to_first_price.ts

test-partner:
	node --test tests/test_partner_consumer.ts

check-links:
	bash scripts/check_links.sh

test-drills:
	node --test tests/test_sre_drills.ts

drills:
	bash scripts/drills/drill_runner.sh

slo-check:
	bash scripts/slo_check.sh

slo-report:
	bash scripts/slo_report.sh --check-error-budget

generate-sbom:
	bash scripts/generate_sbom.sh

test-audit-remediation:
	node --test tests/test_audit_remediation.ts

all-tests: test test-simulation test-hardening test-math-golden test-math-checked test-v2-math test-v2-golden test-v2-contracts test-v2-shadow-parity fuzz-math fuzz-contracts fuzz-v2-contracts lint-c lint-claims verify-claims check-links drills slo-check slo-report generate-sbom test-deploy test-runtime-assumptions test-observability coverage test-api test-sdk test-indexer test-gateway test-web test-mcp test-time-to-first-price test-partner test-audit-remediation run-example

coverage:
	bash scripts/coverage_gate.sh

clean-tests:
	rm -f tests/test_math tests/test_simulation tests/test_contracts tests/test_bench tests/test_oracle_hardening tests/test_math_golden tests/test_math_checked tests/fuzz_math_diff tests/fuzz_contracts tests/cov_* tests/*.gcda tests/*.gcno src/*.gcda src/*.gcno *.gcov

