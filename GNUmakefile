BASEDIR:=$(CURDIR)/build
THRU_C_SDK_DIR:=$(HOME)/.thru/sdk/c/thru-sdk
RISCV_TOOLCHAIN_ROOT:=$(HOME)/.thru/sdk/toolchain
CPPFLAGS+=-I$(CURDIR)/include -I$(CURDIR)/src

include $(THRU_C_SDK_DIR)/thru_c_program.mk

test:
	gcc -O2 -fsanitize=address,undefined -Iinclude -Isrc tests/test_thru_math.c src/thru_math.c -o tests/test_math
	./tests/test_math
	gcc -O2 -fsanitize=address,undefined -Iinclude -Isrc -I$(THRU_C_SDK_DIR)/include tests/test_contracts.c src/thru_math.c -o tests/test_contracts
	./tests/test_contracts

test-simulation:
	gcc -O2 -fsanitize=address,undefined -Iinclude tests/test_simulation.c src/thru_math.c -o tests/test_simulation
	./tests/test_simulation

all-tests: test test-simulation
