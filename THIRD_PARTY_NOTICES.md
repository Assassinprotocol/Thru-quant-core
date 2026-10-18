# Third-Party Notices & Licensing

This project incorporates components and build dependencies licensed under open-source software licenses:

---

## 1. Thru Network C SDK (`thru-sdk`)
- **Source:** Thru Network (`~/.thru/sdk/c/thru-sdk`)
- **License:** Apache License 2.0 / MIT
- **Usage:** Header interfaces (`tn_sdk.h`, `tn_sdk_syscall.h`) and build system configurations for ThruVM.

---

## 2. Picolibc
- **Copyright:** (c) Keith Packard and individual contributors
- **License:** BSD-style (3-Clause BSD / 2-Clause BSD)
- **Usage:** Embedded C standard library utilized during RISC-V target compilation (`rv64imc`).

---

## 3. blst (BLS12-381 signature library)
- **Copyright:** (c) 2020 Supranational LLC
- **License:** Apache License 2.0
- **Usage:** Cryptographic signature verification routines linked into ThruVM program binaries.

---

## 4. Go Standard Library & Dependencies
- **Copyright:** (c) 2009 The Go Authors
- **License:** BSD-3-Clause
- **Usage:** Go runtime and standard library packages used by `feeder/` and `api/`.

---

## 5. TypeScript & Node Dependencies
- **Copyright:** (c) Microsoft Corporation and open-source contributors
- **License:** Apache License 2.0 / MIT
- **Usage:** Build tooling and type definitions for `@thru-quant/core-sdk`.
