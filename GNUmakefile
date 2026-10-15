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

test-api:
	go test -v ./...

build-api:
	go build -o build/thru_oracle_api ./cmd/api

run-api: build-api
	./build/thru_oracle_api --port 8080 --static-dir ./visualizer

bench-math:
	gcc -O3 -Iinclude tests/test_math_bench.c src/thru_math.c -o tests/test_bench
	./tests/test_bench
	rm -f tests/test_bench

bench-api:
	go test -bench=. -benchmem ./api

all-tests: test test-simulation test-api

clean-tests:
	rm -f tests/test_math tests/test_simulation tests/test_contracts tests/test_bench

