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

lint-c:
	gcc -fsyntax-only -Wall -Wextra -Wshadow -Wconversion -Werror -Iinclude -Isrc src/market_oracle.c src/clob_engine.c src/thru_math.c

test-api:
	go test -v ./...

build-api:
	go build -o build/thru_oracle_api ./cmd/api

build-feeder:
	go build -o build/feeder ./feeder

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

all-tests: test test-simulation test-hardening test-math-golden lint-c test-api test-sdk run-example

clean-tests:
	rm -f tests/test_math tests/test_simulation tests/test_contracts tests/test_bench tests/test_oracle_hardening tests/test_math_golden

