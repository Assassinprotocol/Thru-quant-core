/* Golden-vector test for q64_exp / q64_ln.
 * Vectors were generated OFFLINE with Python decimal (prec=100) from the EXACT raw Q64.64 input, so this test
 * has no libm / long double / platform dependency and can also run on the RV64 target.
 * Tolerances (Phase 7 acceptance): exp: max(4 ulp, 2^-48 relative); ln: 64 ulp.  (Measured: exp 5.4e-17 rel, ln 5.3 ulp.)
 * Regenerate: see docs/PHASE7_8_AUDIT_UPGRADE_SPEC.md, section M1. */
#include <stdio.h>
#include <stdint.h>
#include "thru_math.h"

typedef struct { int64_t xh; uint64_t xl; int64_t yh; uint64_t yl; } vec_t;

static const vec_t EXP_V[] = {
    { -20LL, 0x0000000000000000ULL, 0LL, 0x00000008da432afaULL },
    { -11LL, 0x8000000000000000ULL, 0LL, 0x0001cdfc263f6a0cULL },
    { -7LL, 0x1999999999998000ULL, 0LL, 0x00420bd5758ac497ULL },
    { -3LL, 0x481eae9d7512e000ULL, 0LL, 0x10e49787e205484aULL },
    { -1LL, 0x0000000000000000ULL, 0LL, 0x5e2d58d8b3bcdf1bULL },
    { -1LL, 0x004189374bc6a800ULL, 0LL, 0x5e4577ed2637f571ULL },
    { -1LL, 0x8000000000000000ULL, 0LL, 0x9b4597e37cb04ff4ULL },
    { -1LL, 0xe666666666666600ULL, 0LL, 0xe7a36ccea959d3a5ULL },
    { -1LL, 0xfffffffbb47d05f6ULL, 0LL, 0xfffffffbb47d05ffULL },
    { 0LL, 0x000000044b82fa0aULL, 1LL, 0x000000044b82fa13ULL },
    { 0LL, 0x1999999999999a00ULL, 1LL, 0x1aec7b35a00d3a21ULL },
    { 0LL, 0x8000000000000000ULL, 1LL, 0xa61298e1e069bc97ULL },
    { 0LL, 0xb17217f7d1cf7800ULL, 1LL, 0xfffffffffffffca8ULL },
    { 0LL, 0xffbe76c8b4395800ULL, 2LL, 0xb72f42fa823252c7ULL },
    { 1LL, 0x0000000000000000ULL, 2LL, 0xb7e151628aed2a6bULL },
    { 1LL, 0x8000000000000000ULL, 4LL, 0x7b4ff993f15055f7ULL },
    { 2LL, 0xb333333333334000ULL, 14LL, 0xe136192b951ef515ULL },
    { 5LL, 0x0000000000000000ULL, 148LL, 0x69c4cb819c78fb38ULL },
    { 10LL, 0x8000000000000000ULL, 36315LL, 0x80af4269d9bc1c42ULL },
    { 13LL, 0x0000000000000000ULL, 442413LL, 0x645ab2554d531d36ULL },
    { 20LL, 0x0000000000000000ULL, 485165195LL, 0x68e80402189797f9ULL },
    { 30LL, 0x0000000000000000ULL, 10686474581524LL, 0x764f43e201f73a54ULL },
    { 40LL, 0x0000000000000000ULL, 235385266837019985LL, 0x686c20e8b55b3b8bULL },
    { 42LL, 0xe666666666660000ULL, 4277926057321139984LL, 0x7ad294be8138ca5dULL },
    { -8LL, 0xf40c29bbdd88c000ULL, 0LL, 0x003908f722325e52ULL },
    { -14LL, 0x08b20ef975ab0000ULL, 0LL, 0x00000e6ec8196751ULL },
    { 6LL, 0x0991aa3f8cbb8000ULL, 418LL, 0xcb3d43bfbef6c582ULL },
    { -18LL, 0xe5bf611c83210000ULL, 0LL, 0x000000a07a8c4f03ULL },
    { 1LL, 0x6f6e857756565000ULL, 4LL, 0x33690ea89b037370ULL },
    { -6LL, 0xa0a78dec19f7c000ULL, 0LL, 0x013044d0f7e5dbebULL },
    { -18LL, 0x51e8b38c78b90000ULL, 0LL, 0x0000005a13c18a4fULL },
    { 0LL, 0x4c245414a19a1000ULL, 1LL, 0x58ad39de1e926a92ULL },
    { -19LL, 0x7ff49e6f63b20000ULL, 0LL, 0x00000027aaeb6d5eULL },
    { -3LL, 0x5888241521ea0000ULL, 0LL, 0x1202eafdf5c0c1f3ULL },
    { -18LL, 0xcb51cd341d350000ULL, 0LL, 0x00000090bcfbe2d3ULL },
    { -17LL, 0xa0e6b8c264fb0000ULL, 0LL, 0x0000014d5cc8fc76ULL },
    { -4LL, 0xfb13954cf290c000ULL, 0LL, 0x0c80b1442f1fe0e7ULL },
    { 13LL, 0x12f73bd44a228000ULL, 476434LL, 0x3d87d8e4d4d85f31ULL },
    { -16LL, 0xf3bb69bccbe78000ULL, 0LL, 0x000004e45d2d6fdeULL },
    { -12LL, 0xedf78d25fefe8000ULL, 0LL, 0x00010526214ce6caULL },
    { 5LL, 0x18ea8be94699c000ULL, 163LL, 0x95996cf0aa056e5aULL },
    { 17LL, 0xe88a214dfad70000ULL, 59910221LL, 0xe7487dee4b35ddf3ULL },
    { 3LL, 0x1588c0eec81f4000ULL, 21LL, 0xd922c9242c220032ULL },
    { -5LL, 0xde02103f571cc000ULL, 0LL, 0x041b1495acea54f9ULL },
    { 19LL, 0x0cda2f1c33790000ULL, 187671607LL, 0x59a957925a164791ULL },
    { -19LL, 0xdd01b3c9c6880000ULL, 0LL, 0x000000390e194bd1ULL },
    { 14LL, 0x56b78eaab0cc0000ULL, 1687465LL, 0xad539615d16cdea9ULL },
    { -9LL, 0x95995e1759db0000ULL, 0LL, 0x000e82251fa69164ULL },
};
static const vec_t LN_V[] = {
    { 0LL, 0x0000100000000000ULL, -14LL, 0x231620a39bca7e94ULL },
    { 0LL, 0x004189374bc6a7f0ULL, -7LL, 0x179d599c0017f06dULL },
    { 0LL, 0x4000000000000000ULL, -2LL, 0x9d1bd0105c610ca8ULL },
    { 0LL, 0x8000000000000000ULL, -1LL, 0x4e8de8082e308654ULL },
    { 0LL, 0xb504816f0068d800ULL, -1LL, 0xa746531ef57689abULL },
    { 0LL, 0xfff972474538f000ULL, -1LL, 0xfff97231cb4c38d0ULL },
    { 1LL, 0x000001ad7f29b000ULL, 0LL, 0x000001ad7f2847b6ULL },
    { 1LL, 0x004189374bc6a000ULL, 0LL, 0x004180d53e30f30fULL },
    { 1LL, 0x028f5c28f5c29000ULL, 0LL, 0x028c1ad99946cf79ULL },
    { 1LL, 0x6a0902de00d1b000ULL, 0LL, 0x58b86b16c7460357ULL },
    { 1LL, 0x8000000000000000ULL, 0LL, 0x67cc8fb2fe612fcbULL },
    { 2LL, 0x0000000000000000ULL, 0LL, 0xb17217f7d1cf79acULL },
    { 3LL, 0x0000000000000000ULL, 1LL, 0x193ea7aad030a977ULL },
    { 10LL, 0x0000000000000000ULL, 2LL, 0x4d763776aaa2b05cULL },
    { 83459LL, 0x8000000000000000ULL, 11LL, 0x55059aac8ad822d2ULL },
    { 3250LL, 0x0000000000000000ULL, 8LL, 0x161efbda8dd33d8cULL },
    { 1000000LL, 0x0000000000000000ULL, 13LL, 0xd0c54cc7ffd02226ULL },
    { 1000000000LL, 0x0000000000000000ULL, 20LL, 0xb927f32bffb83339ULL },
    { 1099511627776LL, 0x0000000000000000ULL, 27LL, 0xb9d3beb8c86b02d8ULL },
    { 4611686018427387904LL, 0x0000000000000000ULL, 42LL, 0xf9a1ce04d03f779bULL },
    { 0LL, 0x001932fd9896fcb7ULL, -8LL, 0x22eed2a6138fe25fULL },
    { 0LL, 0x000862260d5ce874ULL, -9LL, 0x09309a0346b7fb35ULL },
    { 0LL, 0x5b12022322ca6400ULL, -2LL, 0xf76994b593d2c21eULL },
    { 524941547LL, 0xee5a4d0000000000ULL, 20LL, 0x142c124b147b5435ULL },
    { 0LL, 0x0072d91b142b08d0ULL, -7LL, 0xa73bbc1b7ad84194ULL },
    { 30489LL, 0x2e918d7744000000ULL, 10LL, 0x533b89660cfef92fULL },
    { 330618LL, 0x8c27b65140000000ULL, 12LL, 0xb56eb601dfd1bacdULL },
    { 5LL, 0x1399becc6d03c000ULL, 1LL, 0x9fe810e50ef491e7ULL },
    { 7458LL, 0x7d8abd261f000000ULL, 8LL, 0xeac79c443b99a92eULL },
    { 0LL, 0x0000d9df4a54a720ULL, -12LL, 0xbf95994dbdd354b3ULL },
    { 0LL, 0x0000bed1f98d8751ULL, -12LL, 0x9da506f1535e6546ULL },
    { 0LL, 0x0147fe4c6733f110ULL, -6LL, 0xb3e01d20eb6bc091ULL },
    { 1856299LL, 0xead3a9b400000000ULL, 14LL, 0x6f20e68ad46ecdc0ULL },
    { 50LL, 0x681170efde860000ULL, 3LL, 0xeb8d039ebfd7863fULL },
    { 0LL, 0x73443d46339eec00ULL, -1LL, 0x33bada9a167de71cULL },
    { 35950LL, 0x30ddbbca38000000ULL, 10LL, 0x7d6968db6f7e0c9eULL },
    { 146LL, 0x20165ac321280000ULL, 4LL, 0xfc05e1d2fc4eece3ULL },
    { 0LL, 0x3f62001c912aba00ULL, -2LL, 0x9aa0bf566d69a5e1ULL },
    { 212482515LL, 0x9f5e8e0000000000ULL, 19LL, 0x2ca3879336e185bfULL },
    { 4022514LL, 0x08cb807800000000ULL, 15LL, 0x351952a9a518da53ULL },
    { 0LL, 0x06422595c6084a40ULL, -4LL, 0x49eb2f39c22c2d21ULL },
    { 22621LL, 0xbec83e76b0000000ULL, 10LL, 0x06d3a45e11832144ULL },
    { 2920LL, 0x137828ea16000000ULL, 7LL, 0xfab7a9250f38a8bfULL },
    { 6108833334LL, 0xdf88300000000000ULL, 22LL, 0x8872cbc857b95eb3ULL },
};

static q64_t mk(int64_t h, uint64_t l) { return (q64_t)((((uq64_t)(uint64_t)h) << 64) | (uq64_t)l); }
static uq64_t udiff(q64_t a, q64_t b) { return (a > b) ? (uq64_t)(a - b) : (uq64_t)(b - a); }

int main(void) {
    int fail = 0, n = 0; double worst_exp = 0.0, worst_ln = 0.0;
    for (unsigned i = 0; i < sizeof EXP_V / sizeof EXP_V[0]; i++, n++) {
        q64_t x = mk(EXP_V[i].xh, EXP_V[i].xl), want = mk(EXP_V[i].yh, EXP_V[i].yl), got = q64_exp(x);
        uq64_t tol = (uq64_t)want >> 48; if (tol < 4) tol = 4;
        uq64_t d = udiff(got, want); if ((double)d / (double)tol > worst_exp) worst_exp = (double)d / (double)tol;
        if (d > tol) { fail++; printf("[FAIL] exp vec %u: err=%llu ulp tol=%llu ulp\n", i, (unsigned long long)d, (unsigned long long)tol); }
    }
    for (unsigned i = 0; i < sizeof LN_V / sizeof LN_V[0]; i++, n++) {
        q64_t x = mk(LN_V[i].xh, LN_V[i].xl), want = mk(LN_V[i].yh, LN_V[i].yl), got = q64_ln(x);
        uq64_t d = udiff(got, want); if ((double)d / 64.0 > worst_ln) worst_ln = (double)d / 64.0;
        if (d > 64) { fail++; printf("[FAIL] ln vec %u: err=%llu ulp tol=64 ulp\n", i, (unsigned long long)d); }
    }
    printf("math golden: %d vectors, %d failed (worst exp err = %.2f%% of tolerance, worst ln err = %.2f%% of tolerance)\n", n, fail,
           100.0 * worst_exp, 100.0 * worst_ln);
    return fail ? 1 : 0;
}
