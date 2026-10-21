# Build configuration for thru_quant_core programs
# Defines binary targets compiled for ThruVM (RISC-V)

$(call make-bin,market_oracle_c,market_oracle thru_math,,-ltn_sdk)

