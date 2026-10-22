# Build configuration for thru_quant_core programs
# Defines binary targets compiled for ThruVM (RISC-V)

$(call make-bin,market_oracle_c,market_oracle thru_math,,-ltn_sdk)
$(call make-bin,oracle_v2_c,v2/oracle_v2 v2/aggregation_math,,-ltn_sdk)
