/* Auto-generated TypeScript code */
/* WARNING: Do not modify this file directly. It is generated from ABI definitions. */

type __TnIrNode =
  | { readonly op: "zero" }
  | { readonly op: "const"; readonly value: bigint }
  | { readonly op: "field"; readonly param: string }
  | {
      readonly op: "add";
      readonly left: __TnIrNode;
      readonly right: __TnIrNode;
    }
  | {
      readonly op: "sub";
      readonly left: __TnIrNode;
      readonly right: __TnIrNode;
    }
  | {
      readonly op: "mul";
      readonly left: __TnIrNode;
      readonly right: __TnIrNode;
    }
  | {
      readonly op:
        | "div"
        | "mod"
        | "bitAnd"
        | "bitOr"
        | "bitXor"
        | "leftShift"
        | "rightShift";
      readonly left: __TnIrNode;
      readonly right: __TnIrNode;
    }
  | {
      readonly op: "align";
      readonly alignment: number;
      readonly node: __TnIrNode;
    }
  | {
      readonly op: "switch";
      readonly tag: string;
      readonly cases: readonly { readonly value: number; readonly node: __TnIrNode }[];
      readonly default?: __TnIrNode;
    }
  | {
      readonly op: "call";
      readonly typeName: string;
      readonly args: readonly { readonly name: string; readonly source: string }[];
    }
  | {
      readonly op: "sumOverArray";
      readonly count: __TnIrNode;
      readonly elementTypeName: string;
      readonly fieldName: string;
    };

type __TnIrContext = {
  params: Record<string, bigint>;
  buffer?: Uint8Array;
  typeName?: string;
};

type __TnValidateResult = {
  ok: boolean;
  code?: string;
  consumed?: bigint;
  params?: Record<string, bigint>;
};
type __TnEvalResult =
  | { ok: true; value: bigint }
  | { ok: false; code: string };
type __TnBuilderLike = { build(): Uint8Array };
type __TnStructFieldInput =
  | Uint8Array
  | __TnBuilderLike
  | { buffer?: Uint8Array }
  | { asUint8Array?: () => Uint8Array }
  | { bytes?: () => Uint8Array };
type __TnVariantDescriptor = {
  readonly name: string;
  readonly tag: number;
  readonly payloadSize: number | null;
  readonly payloadType?: string;
  readonly createPayloadBuilder?: () => unknown | null;
};
type __TnVariantSelectorResult<Parent> = {
  select(
    name: string
  ): { writePayload(payload: Uint8Array | __TnBuilderLike): { finish(): Parent } };
  finish(): Parent;
};
type __TnFamWriterResult<Parent> = {
  write(payload: Uint8Array | __TnBuilderLike): { finish(): Parent };
  finish(): Parent;
};
type __TnConsole = { warn?: (...args: unknown[]) => void };

const __tnWarnings = new Set<string>();
const __tnHasNativeBigInt = typeof BigInt === "function";
const __tnHasBigIntDataView =
  typeof DataView !== "undefined" &&
  typeof DataView.prototype.getBigInt64 === "function" &&
  typeof DataView.prototype.getBigUint64 === "function" &&
  typeof DataView.prototype.setBigInt64 === "function" &&
  typeof DataView.prototype.setBigUint64 === "function";
const __tnConsole: __TnConsole | undefined =
  typeof globalThis !== "undefined"
    ? (globalThis as { console?: __TnConsole }).console
    : undefined;

function __tnLogWarn(message: string): void {
  if (__tnConsole && typeof __tnConsole.warn === "function") {
    __tnConsole.warn(message);
  }
}

function __tnWarnOnce(message: string): void {
  if (!__tnWarnings.has(message)) {
    __tnWarnings.add(message);
    __tnLogWarn(message);
  }
}

function __tnResolveBuilderInput(
  input: Uint8Array | __TnBuilderLike,
  context: string
): Uint8Array {
  if (input instanceof Uint8Array) {
    return new Uint8Array(input);
  }
  if (input && typeof (input as __TnBuilderLike).build === "function") {
    const built = (input as __TnBuilderLike).build();
    if (!(built instanceof Uint8Array)) {
      throw new Error(`${context}: builder did not return Uint8Array`);
    }
    return new Uint8Array(built);
  }
  throw new Error(`${context}: expected Uint8Array or builder`);
}

function __tnResolveStructFieldInput(
  input: __TnStructFieldInput,
  context: string
): Uint8Array {
  if (
    input instanceof Uint8Array ||
    (input && typeof (input as __TnBuilderLike).build === "function")
  ) {
    return __tnResolveBuilderInput(input as Uint8Array | __TnBuilderLike, context);
  }
  if (input && typeof (input as { asUint8Array?: () => Uint8Array }).asUint8Array === "function") {
    const bytes = (input as { asUint8Array: () => Uint8Array }).asUint8Array();
    return new Uint8Array(bytes);
  }
  if (input && typeof (input as { bytes?: () => Uint8Array }).bytes === "function") {
    const bytes = (input as { bytes: () => Uint8Array }).bytes();
    return new Uint8Array(bytes);
  }
  if (input && (input as { buffer?: unknown }).buffer instanceof Uint8Array) {
    return new Uint8Array((input as { buffer: Uint8Array }).buffer);
  }
  throw new Error(`${context}: expected Uint8Array, builder, or view-like value`);
}

function __tnMaybeCallBuilder(ctor: unknown): unknown | null {
  if (!ctor) {
    return null;
  }
  const builderFn = (ctor as { builder?: () => unknown }).builder;
  return typeof builderFn === "function" ? builderFn() : null;
}

function __tnCreateVariantSelector<Parent, Descriptor extends __TnVariantDescriptor>(
  parent: Parent,
  descriptors: readonly Descriptor[],
  assign: (descriptor: Descriptor, payload: Uint8Array) => void
): __TnVariantSelectorResult<Parent> {
  return {
    select(name: string) {
      const descriptor = descriptors.find((variant) => variant.name === name);
      if (!descriptor) {
        throw new Error(`Unknown variant '${name}'`);
      }
      return {
        writePayload(payload: Uint8Array | __TnBuilderLike) {
          const bytes = __tnResolveBuilderInput(
            payload,
            `variant ${descriptor.name}`
          );
          if (
            descriptor.payloadSize !== null &&
            bytes.length !== descriptor.payloadSize
          ) {
            throw new Error(
              `Payload for ${descriptor.name} must be ${descriptor.payloadSize} bytes`
            );
          }
          assign(descriptor, bytes);
          return {
            finish(): Parent {
              return parent;
            },
          };
        },
      };
    },
    finish(): Parent {
      return parent;
    },
  };
}

function __tnCreateFamWriter<Parent>(
  parent: Parent,
  fieldName: string,
  assign: (bytes: Uint8Array) => void
): __TnFamWriterResult<Parent> {
  let hasWritten = false;
  return {
    write(payload: Uint8Array | __TnBuilderLike) {
      const bytes = __tnResolveBuilderInput(
        payload,
        `flexible array '${fieldName}'`
      );
      const copy = new Uint8Array(bytes);
      assign(copy);
      hasWritten = true;
      return {
        finish(): Parent {
          return parent;
        },
      };
    },
    finish(): Parent {
      if (!hasWritten) {
        throw new Error(
          `flexible array '${fieldName}' requires write() before finish()`
        );
      }
      return parent;
    },
  };
}

const __tnMask32 = __tnHasNativeBigInt
  ? (BigInt(1) << BigInt(32)) - BigInt(1)
  : 0xffffffff;
const __tnSignBit32 = __tnHasNativeBigInt
  ? BigInt(1) << BigInt(31)
  : 0x80000000;

function __tnToBigInt(value: number | bigint): bigint {
  if (__tnHasNativeBigInt) {
    return typeof value === "bigint" ? value : BigInt(value);
  }
  if (typeof value === "bigint") return value;
  if (!Number.isFinite(value)) {
    throw new Error("IR runtime received non-finite numeric input");
  }
  if (!Number.isSafeInteger(value)) {
    __tnWarnOnce(
      `[thru-net] Precision loss while polyfilling BigInt (value=${value})`
    );
  }
  return (value as unknown) as bigint;
}

function __tnBigIntToNumber(value: bigint, context: string): number {
  if (__tnHasNativeBigInt) {
    const converted = Number(value);
    if (!Number.isFinite(converted)) {
      throw new Error(`${context} overflowed Number range`);
    }
    return converted;
  }
  return value as unknown as number;
}

function __tnBigIntEquals(lhs: bigint, rhs: bigint): boolean {
  if (__tnHasNativeBigInt) return lhs === rhs;
  return (lhs as unknown as number) === (rhs as unknown as number);
}

function __tnBigIntGreaterThan(lhs: bigint, rhs: bigint): boolean {
  if (__tnHasNativeBigInt) return lhs > rhs;
  return (lhs as unknown as number) > (rhs as unknown as number);
}

function __tnPopcount(value: number | bigint): number {
  let v =
    typeof value === "bigint"
      ? Number(value & BigInt(0xffffffff))
      : Number(value) >>> 0;
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function __tnRaiseIrError(code: string, message: string): never {
  const err = new Error(message);
  (err as { code?: string }).code = code;
  throw err;
}

function __tnCheckedAdd(lhs: bigint, rhs: bigint): bigint {
  if (__tnHasNativeBigInt) {
    const result = (lhs as bigint) + (rhs as bigint);
    if (result < BigInt(0)) {
      __tnRaiseIrError(
        "tn.ir.overflow",
        "IR runtime detected negative size via addition"
      );
    }
    return result;
  }
  const left = lhs as unknown as number;
  const right = rhs as unknown as number;
  const sum = left + right;
  if (sum < 0 || !Number.isFinite(sum)) {
    __tnRaiseIrError(
      "tn.ir.overflow",
      "IR runtime detected invalid addition result"
    );
  }
  if (!Number.isSafeInteger(sum)) {
    __tnWarnOnce("[thru-net] Precision loss while polyfilling BigInt addition");
  }
  return (sum as unknown) as bigint;
}

function __tnCheckedSub(lhs: bigint, rhs: bigint): bigint {
  if (__tnHasNativeBigInt) {
    const result = (lhs as bigint) - (rhs as bigint);
    if (result < BigInt(0)) {
      __tnRaiseIrError(
        "tn.ir.overflow",
        "IR runtime detected negative size via subtraction"
      );
    }
    return result;
  }
  const left = lhs as unknown as number;
  const right = rhs as unknown as number;
  const diff = left - right;
  if (diff < 0 || !Number.isFinite(diff)) {
    __tnRaiseIrError(
      "tn.ir.overflow",
      "IR runtime detected invalid subtraction result"
    );
  }
  if (!Number.isSafeInteger(diff)) {
    __tnWarnOnce("[thru-net] Precision loss while polyfilling BigInt subtraction");
  }
  return (diff as unknown) as bigint;
}

function __tnCheckedMul(lhs: bigint, rhs: bigint): bigint {
  if (__tnHasNativeBigInt) {
    const result = (lhs as bigint) * (rhs as bigint);
    if (result < BigInt(0)) {
      __tnRaiseIrError(
        "tn.ir.overflow",
        "IR runtime detected negative size via multiplication"
      );
    }
    return result;
  }
  const left = lhs as unknown as number;
  const right = rhs as unknown as number;
  const product = left * right;
  if (product < 0 || !Number.isFinite(product)) {
    __tnRaiseIrError(
      "tn.ir.overflow",
      "IR runtime detected invalid multiplication result"
    );
  }
  if (!Number.isSafeInteger(product)) {
    __tnWarnOnce(
      "[thru-net] Precision loss while polyfilling BigInt multiplication"
    );
  }
  return (product as unknown) as bigint;
}

function __tnCheckedDiv(lhs: bigint, rhs: bigint): bigint {
  if (__tnBigIntEquals(rhs, __tnToBigInt(0))) {
    __tnRaiseIrError("tn.ir.overflow", "IR runtime division by zero");
  }
  if (__tnHasNativeBigInt) return (lhs as bigint) / (rhs as bigint);
  const quotient = Math.floor((lhs as unknown as number) / (rhs as unknown as number));
  return (quotient as unknown) as bigint;
}

function __tnCheckedMod(lhs: bigint, rhs: bigint): bigint {
  if (__tnBigIntEquals(rhs, __tnToBigInt(0))) {
    __tnRaiseIrError("tn.ir.overflow", "IR runtime modulo by zero");
  }
  if (__tnHasNativeBigInt) return (lhs as bigint) % (rhs as bigint);
  return (((lhs as unknown as number) % (rhs as unknown as number)) as unknown) as bigint;
}

function __tnBitwise(
  lhs: bigint,
  rhs: bigint,
  op: "and" | "or" | "xor"
): bigint {
  if (__tnHasNativeBigInt) {
    if (op === "and") return (lhs as bigint) & (rhs as bigint);
    if (op === "or") return (lhs as bigint) | (rhs as bigint);
    return (lhs as bigint) ^ (rhs as bigint);
  }
  const left = lhs as unknown as number;
  const right = rhs as unknown as number;
  const maxU32 = 0xffffffff;
  if (
    !Number.isInteger(left) ||
    !Number.isInteger(right) ||
    left < 0 ||
    right < 0 ||
    left > maxU32 ||
    right > maxU32
  ) {
    __tnRaiseIrError(
      "tn.ir.overflow",
      "IR runtime bitwise operation requires BigInt for values outside u32 range"
    );
  }
  const result = op === "and" ? left & right : op === "or" ? left | right : left ^ right;
  return ((result >>> 0) as unknown) as bigint;
}

function __tnCheckedShift(
  lhs: bigint,
  rhs: bigint,
  direction: "left" | "right"
): bigint {
  const amount = __tnBigIntToNumber(rhs, "IR shift amount");
  if (amount < 0 || amount >= 64 || !Number.isInteger(amount)) {
    __tnRaiseIrError("tn.ir.overflow", "IR runtime invalid shift amount");
  }
  if (__tnHasNativeBigInt) {
    const shift = BigInt(amount);
    return direction === "left" ? (lhs as bigint) << shift : (lhs as bigint) >> shift;
  }
  const value = lhs as unknown as number;
  const result = direction === "left" ? value * 2 ** amount : Math.floor(value / 2 ** amount);
  if (!Number.isSafeInteger(result)) {
    __tnWarnOnce("[thru-net] Precision loss while polyfilling BigInt shift");
  }
  return (result as unknown) as bigint;
}

function __tnAlign(value: bigint, alignment: number): bigint {
  if (alignment <= 1) return value;
  const alignBig = __tnToBigInt(alignment);
  if (__tnHasNativeBigInt) {
    const remainder = value % alignBig;
    if (__tnBigIntEquals(remainder, __tnToBigInt(0))) {
      return value;
    }
    const delta = alignBig - remainder;
    return __tnCheckedAdd(value, delta);
  }
  const current = __tnBigIntToNumber(value, "IR align");
  const alignNum = alignment >>> 0;
  const remainder = current % alignNum;
  const next = remainder === 0 ? current : current + (alignNum - remainder);
  return __tnToBigInt(next);
}

function __tnSplitUint64(value: bigint): { high: number; low: number } {
  if (__tnHasNativeBigInt) {
    const low = Number(value & (__tnMask32 as bigint));
    const high = Number((value >> BigInt(32)) & (__tnMask32 as bigint));
    return { high, low };
  }
  const num = __tnBigIntToNumber(value, "DataView.setBigUint64");
  const low = num >>> 0;
  const high = Math.floor(num / 4294967296) >>> 0;
  return { high, low };
}

function __tnSplitInt64(value: bigint): { high: number; low: number } {
  if (__tnHasNativeBigInt) {
    const low = Number(value & (__tnMask32 as bigint));
    let high = Number((value >> BigInt(32)) & (__tnMask32 as bigint));
    if ((BigInt(high) & (__tnSignBit32 as bigint)) !== BigInt(0)) {
      high -= 0x100000000;
    }
    return { high, low };
  }
  const num = __tnBigIntToNumber(value, "DataView.setBigInt64");
  const low = num >>> 0;
  const high = Math.floor(num / 4294967296);
  return { high, low };
}

function __tnPolyfillReadUint64(
  view: DataView,
  offset: number,
  littleEndian: boolean
): bigint {
  const low = littleEndian
    ? view.getUint32(offset, true)
    : view.getUint32(offset + 4, false);
  const high = littleEndian
    ? view.getUint32(offset + 4, true)
    : view.getUint32(offset, false);
  if (__tnHasNativeBigInt) {
    return (BigInt(high) << BigInt(32)) | BigInt(low);
  }
  const value = high * 4294967296 + low;
  if (!Number.isSafeInteger(value)) {
    __tnWarnOnce(
      "[thru-net] Precision loss while polyfilling DataView.getBigUint64"
    );
  }
  return (value as unknown) as bigint;
}

function __tnPolyfillReadInt64(
  view: DataView,
  offset: number,
  littleEndian: boolean
): bigint {
  const low = littleEndian
    ? view.getUint32(offset, true)
    : view.getUint32(offset + 4, false);
  const high = littleEndian
    ? view.getInt32(offset + 4, true)
    : view.getInt32(offset, false);
  if (__tnHasNativeBigInt) {
    return (BigInt(high) << BigInt(32)) | BigInt(low);
  }
  const value = high * 4294967296 + low;
  if (!Number.isSafeInteger(value)) {
    __tnWarnOnce(
      "[thru-net] Precision loss while polyfilling DataView.getBigInt64"
    );
  }
  return (value as unknown) as bigint;
}

function __tnPolyfillWriteUint64(
  view: DataView,
  offset: number,
  value: bigint,
  littleEndian: boolean
): void {
  const parts = __tnSplitUint64(value);
  if (littleEndian) {
    view.setUint32(offset, parts.low, true);
    view.setUint32(offset + 4, parts.high, true);
  } else {
    view.setUint32(offset, parts.high, false);
    view.setUint32(offset + 4, parts.low, false);
  }
}

function __tnPolyfillWriteInt64(
  view: DataView,
  offset: number,
  value: bigint,
  littleEndian: boolean
): void {
  const parts = __tnSplitInt64(value);
  if (littleEndian) {
    view.setUint32(offset, parts.low >>> 0, true);
    view.setInt32(offset + 4, parts.high | 0, true);
  } else {
    view.setInt32(offset, parts.high | 0, false);
    view.setUint32(offset + 4, parts.low >>> 0, false);
  }
}

if (typeof DataView !== "undefined" && !__tnHasBigIntDataView) {
  const proto = DataView.prototype as unknown as Record<string, unknown>;
  if (typeof proto.getBigUint64 !== "function") {
    (proto as any).getBigUint64 = function (
      offset: number,
      littleEndian?: boolean
    ): bigint {
      __tnWarnOnce(
        "[thru-net] Polyfilling DataView.getBigUint64; precision may be lost"
      );
      return __tnPolyfillReadUint64(this, offset, !!littleEndian);
    };
  }
  if (typeof proto.getBigInt64 !== "function") {
    (proto as any).getBigInt64 = function (
      offset: number,
      littleEndian?: boolean
    ): bigint {
      __tnWarnOnce(
        "[thru-net] Polyfilling DataView.getBigInt64; precision may be lost"
      );
      return __tnPolyfillReadInt64(this, offset, !!littleEndian);
    };
  }
  if (typeof proto.setBigUint64 !== "function") {
    (proto as any).setBigUint64 = function (
      offset: number,
      value: bigint,
      littleEndian?: boolean
    ): void {
      __tnWarnOnce(
        "[thru-net] Polyfilling DataView.setBigUint64; precision may be lost"
      );
      __tnPolyfillWriteUint64(this, offset, value, !!littleEndian);
    };
  }
  if (typeof proto.setBigInt64 !== "function") {
    (proto as any).setBigInt64 = function (
      offset: number,
      value: bigint,
      littleEndian?: boolean
    ): void {
      __tnWarnOnce(
        "[thru-net] Polyfilling DataView.setBigInt64; precision may be lost"
      );
      __tnPolyfillWriteInt64(this, offset, value, !!littleEndian);
    };
  }
  if (!__tnHasNativeBigInt) {
    __tnWarnOnce(
      "[thru-net] BigInt is unavailable; falling back to lossy 64-bit polyfill"
    );
  }
}

const __tnFootprintRegistry: Record<
  string,
  (params: Record<string, bigint>) => bigint
> = {};
const __tnValidateRegistry: Record<
  string,
  (buffer: Uint8Array, params: Record<string, bigint>) => __TnValidateResult
> = {};
const __tnDynamicValidateRegistry: Record<
  string,
  (buffer: Uint8Array) => __TnValidateResult
> = {};

function __tnRegisterFootprint(
  typeName: string,
  fn: (params: Record<string, bigint>) => bigint
): void {
  __tnFootprintRegistry[typeName] = fn;
}

function __tnRegisterValidate(
  typeName: string,
  fn: (buffer: Uint8Array, params: Record<string, bigint>) => __TnValidateResult
): void {
  __tnValidateRegistry[typeName] = fn;
}

function __tnRegisterDynamicValidate(
  typeName: string,
  fn: (buffer: Uint8Array) => __TnValidateResult
): void {
  __tnDynamicValidateRegistry[typeName] = fn;
}

function __tnInvokeFootprint(
  typeName: string,
  params: Record<string, bigint>
): bigint {
  const fn = __tnFootprintRegistry[typeName];
  if (!fn) throw new Error(`IR runtime missing footprint for ${typeName}`);
  return fn(params);
}

function __tnInvokeValidate(
  typeName: string,
  buffer: Uint8Array,
  params: Record<string, bigint>
): __TnValidateResult {
  const fn = __tnValidateRegistry[typeName];
  if (!fn) throw new Error(`IR runtime missing validate helper for ${typeName}`);
  return fn(buffer, params);
}

function __tnInvokeDynamicValidate(
  typeName: string,
  buffer: Uint8Array
): __TnValidateResult {
  const fn = __tnDynamicValidateRegistry[typeName];
  if (!fn) throw new Error(`IR runtime missing dynamic validate helper for ${typeName}`);
  return fn(buffer);
}

function __tnEvalFootprint(node: __TnIrNode, ctx: __TnIrContext): bigint {
  return __tnEvalIrNode(node, ctx, __tnToBigInt(0));
}

function __tnTryEvalFootprint(
  node: __TnIrNode,
  ctx: __TnIrContext
): __TnEvalResult {
  return __tnTryEvalIr(node, ctx);
}

function __tnTryEvalIr(
  node: __TnIrNode,
  ctx: __TnIrContext
): __TnEvalResult {
  try {
    return { ok: true, value: __tnEvalIrNode(node, ctx, __tnToBigInt(0)) };
  } catch (err) {
    return { ok: false, code: __tnNormalizeIrError(err) };
  }
}

function __tnIsEvalError(result: __TnEvalResult): result is { ok: false; code: string } {
  return result.ok === false;
}

function __tnValidateIrTree(
  ir: { readonly typeName: string; readonly root: __TnIrNode },
  buffer: Uint8Array,
  params: Record<string, bigint>
): __TnValidateResult {
  const evalResult = __tnTryEvalIr(ir.root, {
    params,
    buffer,
    typeName: ir.typeName,
  });
  if (__tnIsEvalError(evalResult)) {
    return { ok: false, code: evalResult.code };
  }
  const required = evalResult.value;
  const available = __tnToBigInt(buffer.length);
  if (__tnBigIntGreaterThan(required, available)) {
    return { ok: false, code: "tn.buffer_too_small", consumed: required };
  }
  return { ok: true, consumed: required };
}

function __tnEvalIrNode(
  node: __TnIrNode,
  ctx: __TnIrContext,
  baseOffset: bigint
): bigint {
  switch (node.op) {
    case "zero":
      return __tnToBigInt(0);
    case "const":
      return node.value;
    case "field": {
      if (node.param === "__buffer_size" && ctx.buffer) {
        return __tnToBigInt(ctx.buffer.length);
      }
      const val = ctx.params[node.param];
      if (val === undefined) {
        const prefix = ctx.typeName ? `${ctx.typeName}: ` : "";
        __tnRaiseIrError(
          "tn.ir.missing_param",
          `${prefix}Missing IR parameter '${node.param}'`
        );
      }
      return val;
    }
    case "add":
      {
        const left = __tnEvalIrNode(node.left, ctx, baseOffset);
        const right = __tnEvalIrNode(
          node.right,
          ctx,
          __tnCheckedAdd(baseOffset, left)
        );
        return __tnCheckedAdd(left, right);
      }
    case "sub":
      return __tnCheckedSub(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset)
      );
    case "mul":
      return __tnCheckedMul(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset)
      );
    case "div":
      return __tnCheckedDiv(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset)
      );
    case "mod":
      return __tnCheckedMod(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset)
      );
    case "bitAnd":
      return __tnBitwise(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset),
        "and"
      );
    case "bitOr":
      return __tnBitwise(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset),
        "or"
      );
    case "bitXor":
      return __tnBitwise(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset),
        "xor"
      );
    case "leftShift":
      return __tnCheckedShift(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset),
        "left"
      );
    case "rightShift":
      return __tnCheckedShift(
        __tnEvalIrNode(node.left, ctx, baseOffset),
        __tnEvalIrNode(node.right, ctx, baseOffset),
        "right"
      );
    case "align":
      return __tnAlign(__tnEvalIrNode(node.node, ctx, baseOffset), node.alignment);
    case "switch": {
      const tagVal = ctx.params[node.tag];
      if (tagVal === undefined) {
        const prefix = ctx.typeName ? `${ctx.typeName}: ` : "";
        __tnRaiseIrError(
          "tn.ir.missing_param",
          `${prefix}Missing IR switch tag '${node.tag}'`
        );
      }
      const tagNumber = Number(tagVal);
      for (const caseNode of node.cases) {
        if (caseNode.value === tagNumber) {
          return __tnEvalIrNode(caseNode.node, ctx, baseOffset);
        }
      }
      if (node.default) return __tnEvalIrNode(node.default, ctx, baseOffset);
      __tnRaiseIrError(
        "tn.ir.invalid_tag",
        `Unhandled IR switch value ${tagNumber} for '${node.tag}'`
      );
    }
    case "call": {
      const nestedParams: Record<string, bigint> = Object.create(null);
      for (const arg of node.args) {
        const val = ctx.params[arg.source];
        if (val === undefined) {
          const prefix = ctx.typeName ? `${ctx.typeName}: ` : "";
          __tnRaiseIrError(
            "tn.ir.missing_param",
            `${prefix}Missing IR parameter '${arg.source}' for nested call`
          );
        }
        nestedParams[arg.name] = val;
      }
      if (ctx.buffer) {
        const nestedOffset = __tnBigIntToNumber(baseOffset, "IR nested offset");
        const nestedResult = __tnInvokeValidate(
          node.typeName,
          ctx.buffer.subarray(nestedOffset),
          nestedParams
        );
        if (!nestedResult.ok) {
          const nestedCode =
            nestedResult.code ?? `tn.ir.runtime_error: ${node.typeName}`;
          const prefixed = nestedCode.startsWith("tn.")
            ? nestedCode
            : `tn.ir.runtime_error: ${node.typeName} -> ${nestedCode}`;
          __tnRaiseIrError(
            prefixed,
            `Nested validator ${node.typeName} failed`
          );
        }
        if (nestedResult.consumed !== undefined) {
          return nestedResult.consumed;
        }
      }
      return __tnInvokeFootprint(node.typeName, nestedParams);
    }
    case "sumOverArray": {
      if (!ctx.buffer) {
        __tnRaiseIrError(
          "tn.ir.missing_buffer",
          `Jagged array '${node.fieldName}' requires buffer-backed validation`
        );
      }
      const count = __tnBigIntToNumber(
        __tnEvalIrNode(node.count, ctx, baseOffset),
        `Jagged array '${node.fieldName}' count`
      );
      let cursor = __tnBigIntToNumber(baseOffset, "IR jagged array offset");
      let total = __tnToBigInt(0);
      for (let i = 0; i < count; i++) {
        const result = __tnInvokeDynamicValidate(
          node.elementTypeName,
          ctx.buffer.subarray(cursor)
        );
        if (!result.ok || result.consumed === undefined) {
          const code = result.code ?? "tn.ir.runtime_error";
          __tnRaiseIrError(
            code,
            `Jagged array '${node.fieldName}' element ${i} failed validation`
          );
        }
        cursor += __tnBigIntToNumber(result.consumed, "IR jagged element size");
        total = __tnCheckedAdd(total, result.consumed);
      }
      return total;
    }
    default:
      __tnRaiseIrError(
        "tn.ir.runtime_error",
        `Unsupported IR node ${(node as { op: string }).op}`
      );
  }
}

function __tnNormalizeIrError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const maybeCode = (err as { code?: string }).code;
    if (typeof maybeCode === "string" && maybeCode.length > 0) {
      return maybeCode;
    }
  }
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : typeof err === "string"
      ? err
      : "";
  if (message.includes("Missing IR parameter")) return "tn.ir.missing_param";
  if (message.includes("Unhandled IR switch value")) return "tn.ir.invalid_tag";
  if (
    message.includes("invalid") ||
    message.includes("overflow") ||
    message.includes("negative size")
  ) {
    return "tn.ir.overflow";
  }
  if (message.length > 0) return `tn.ir.runtime_error: ${message}`;
  return "tn.ir.runtime_error";
}

/* ----- TYPE DEFINITION FOR oracle_entry ----- */

const __tn_ir_oracle_entry = {
  typeName: "oracle_entry",
  root: { op: "const", value: 28n }
} as const;

export class oracle_entry {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): oracle_entry {
    if (!buffer || buffer.length === undefined) throw new Error("oracle_entry.__tnCreateView requires a Uint8Array");
    return new oracle_entry(new Uint8Array(buffer));
  }

  static builder(): oracle_entryBuilder {
    return new oracle_entryBuilder();
  }

  static fromBuilder(builder: oracle_entryBuilder): oracle_entry | null {
    const buffer = builder.build();
    return oracle_entry.from_array(buffer);
  }

  get_symbol_id(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_symbol_id(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get symbol_id(): number {
    return this.get_symbol_id();
  }

  set symbol_id(value: number) {
    this.set_symbol_id(value);
  }

  get_price_q64_hi(): bigint {
    const offset = 4;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_price_q64_hi(value: bigint): void {
    const offset = 4;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get price_q64_hi(): bigint {
    return this.get_price_q64_hi();
  }

  set price_q64_hi(value: bigint) {
    this.set_price_q64_hi(value);
  }

  get_price_q64_lo(): bigint {
    const offset = 12;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_price_q64_lo(value: bigint): void {
    const offset = 12;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get price_q64_lo(): bigint {
    return this.get_price_q64_lo();
  }

  set price_q64_lo(value: bigint) {
    this.set_price_q64_lo(value);
  }

  get_volatility_bps(): number {
    const offset = 20;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_volatility_bps(value: number): void {
    const offset = 20;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get volatility_bps(): number {
    return this.get_volatility_bps();
  }

  set volatility_bps(value: number) {
    this.set_volatility_bps(value);
  }

  get_timestamp(): number {
    const offset = 24;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_timestamp(value: number): void {
    const offset = 24;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get timestamp(): number {
    return this.get_timestamp();
  }

  set timestamp(value: number) {
    this.set_timestamp(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_oracle_entry.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_oracle_entry, buffer, __tnParams);
  }

  static __tnInvokeFootprint(__tnParams: Record<string, bigint>): bigint {
    return this.__tnFootprintInternal(__tnParams);
  }

  static __tnInvokeValidate(buffer: Uint8Array, __tnParams: Record<string, bigint>): __TnValidateResult {
    return this.__tnValidateInternal(buffer, __tnParams);
  }

  static footprintIr(): bigint {
    return this.__tnFootprintInternal(Object.create(null));
  }

  static footprint(): number {
    const irResult = this.footprintIr();
      const maxSafe = __tnToBigInt(Number.MAX_SAFE_INTEGER);
    if (__tnBigIntGreaterThan(irResult, maxSafe)) {
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for oracle_entry');
    }
    return __tnBigIntToNumber(irResult, 'oracle_entry::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 28) return { ok: false, code: "tn.buffer_too_small", consumed: 28 };
    return { ok: true, consumed: 28 };
  }

  static new(symbol_id: number, price_q64_hi: bigint, price_q64_lo: bigint, volatility_bps: number, timestamp: number): oracle_entry {
    const buffer = new Uint8Array(28);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, symbol_id, true); /* symbol_id (little-endian) */
    view.setBigUint64(4, price_q64_hi, true); /* price_q64_hi (little-endian) */
    view.setBigUint64(12, price_q64_lo, true); /* price_q64_lo (little-endian) */
    view.setUint32(20, volatility_bps, true); /* volatility_bps (little-endian) */
    view.setUint32(24, timestamp, true); /* timestamp (little-endian) */

    return new oracle_entry(buffer);
  }

  static from_array(buffer: Uint8Array): oracle_entry | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new oracle_entry(buffer);
  }

}

export class oracle_entryBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(28);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_symbol_id(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_price_q64_hi(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(4, cast, true);
    return this;
  }

  set_price_q64_lo(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(12, cast, true);
    return this;
  }

  set_volatility_bps(value: number): this {
    this.view.setUint32(20, value, true);
    return this;
  }

  set_timestamp(value: number): this {
    this.view.setUint32(24, value, true);
    return this;
  }

  build(): Uint8Array {
    return this.buffer.slice();
  }

  buildInto(target: Uint8Array, offset = 0): Uint8Array {
    if (target.length - offset < this.buffer.length) throw new Error("target buffer too small");
    target.set(this.buffer, offset);
    return target;
  }

  finish(): oracle_entry {
    const view = oracle_entry.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build oracle_entry");
    return view;
  }
}

__tnRegisterFootprint("oracle_entry", (params) => oracle_entry.__tnInvokeFootprint(params));
__tnRegisterValidate("oracle_entry", (buffer, params) => oracle_entry.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("oracle_entry", (buffer) => { const result = oracle_entry.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR oracle_init_args ----- */

const __tn_ir_oracle_init_args = {
  typeName: "oracle_init_args",
  root: { op: "const", value: 38n }
} as const;

export class oracle_init_args {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): oracle_init_args {
    if (!buffer || buffer.length === undefined) throw new Error("oracle_init_args.__tnCreateView requires a Uint8Array");
    return new oracle_init_args(new Uint8Array(buffer));
  }

  static builder(): oracle_init_argsBuilder {
    return new oracle_init_argsBuilder();
  }

  static fromBuilder(builder: oracle_init_argsBuilder): oracle_init_args | null {
    const buffer = builder.build();
    return oracle_init_args.from_array(buffer);
  }

  get_instruction_type(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_instruction_type(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get instruction_type(): number {
    return this.get_instruction_type();
  }

  set instruction_type(value: number) {
    this.set_instruction_type(value);
  }

  get_oracle_account_idx(): number {
    const offset = 4;
    return this.view.getUint16(offset, true); /* little-endian */
  }

  set_oracle_account_idx(value: number): void {
    const offset = 4;
    this.view.setUint16(offset, value, true); /* little-endian */
  }

  get oracle_account_idx(): number {
    return this.get_oracle_account_idx();
  }

  set oracle_account_idx(value: number) {
    this.set_oracle_account_idx(value);
  }

  get_seed(): number[] {
    const offset = 6;
    const result: number[] = [];
    for (let i = 0; i < 32; i++) {
      result.push(this.view.getUint8((offset + i * 1)));
    }
    return result;
  }

  set_seed(value: number[]): void {
    const offset = 6;
    if (value.length !== 32) {
      throw new Error('Array length must be 32');
    }
    for (let i = 0; i < 32; i++) {
      this.view.setUint8((offset + i * 1), value[i]);
    }
  }

  get seed(): number[] {
    return this.get_seed();
  }

  set seed(value: number[]) {
    this.set_seed(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_oracle_init_args.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_oracle_init_args, buffer, __tnParams);
  }

  static __tnInvokeFootprint(__tnParams: Record<string, bigint>): bigint {
    return this.__tnFootprintInternal(__tnParams);
  }

  static __tnInvokeValidate(buffer: Uint8Array, __tnParams: Record<string, bigint>): __TnValidateResult {
    return this.__tnValidateInternal(buffer, __tnParams);
  }

  static footprintIr(): bigint {
    return this.__tnFootprintInternal(Object.create(null));
  }

  static footprint(): number {
    const irResult = this.footprintIr();
      const maxSafe = __tnToBigInt(Number.MAX_SAFE_INTEGER);
    if (__tnBigIntGreaterThan(irResult, maxSafe)) {
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for oracle_init_args');
    }
    return __tnBigIntToNumber(irResult, 'oracle_init_args::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 38) return { ok: false, code: "tn.buffer_too_small", consumed: 38 };
    return { ok: true, consumed: 38 };
  }

  static from_array(buffer: Uint8Array): oracle_init_args | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new oracle_init_args(buffer);
  }

}

export class oracle_init_argsBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(38);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_oracle_account_idx(value: number): this {
    this.view.setUint16(4, value, true);
    return this;
  }

  set_seed(values: number[]): this {
    if (values.length !== 32) throw new Error("seed expects 32 elements");
    for (let i = 0; i < values.length; i++) {
      const byteOffset = 6 + i * 1;
      this.view.setUint8(byteOffset, values[i]);
    }
    return this;
  }

  build(): Uint8Array {
    return this.buffer.slice();
  }

  buildInto(target: Uint8Array, offset = 0): Uint8Array {
    if (target.length - offset < this.buffer.length) throw new Error("target buffer too small");
    target.set(this.buffer, offset);
    return target;
  }

  finish(): oracle_init_args {
    const view = oracle_init_args.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build oracle_init_args");
    return view;
  }
}

__tnRegisterFootprint("oracle_init_args", (params) => oracle_init_args.__tnInvokeFootprint(params));
__tnRegisterValidate("oracle_init_args", (buffer, params) => oracle_init_args.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("oracle_init_args", (buffer) => { const result = oracle_init_args.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR oracle_resume_args ----- */

const __tn_ir_oracle_resume_args = {
  typeName: "oracle_resume_args",
  root: { op: "const", value: 6n }
} as const;

export class oracle_resume_args {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): oracle_resume_args {
    if (!buffer || buffer.length === undefined) throw new Error("oracle_resume_args.__tnCreateView requires a Uint8Array");
    return new oracle_resume_args(new Uint8Array(buffer));
  }

  static builder(): oracle_resume_argsBuilder {
    return new oracle_resume_argsBuilder();
  }

  static fromBuilder(builder: oracle_resume_argsBuilder): oracle_resume_args | null {
    const buffer = builder.build();
    return oracle_resume_args.from_array(buffer);
  }

  get_instruction_type(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_instruction_type(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get instruction_type(): number {
    return this.get_instruction_type();
  }

  set instruction_type(value: number) {
    this.set_instruction_type(value);
  }

  get_oracle_account_idx(): number {
    const offset = 4;
    return this.view.getUint16(offset, true); /* little-endian */
  }

  set_oracle_account_idx(value: number): void {
    const offset = 4;
    this.view.setUint16(offset, value, true); /* little-endian */
  }

  get oracle_account_idx(): number {
    return this.get_oracle_account_idx();
  }

  set oracle_account_idx(value: number) {
    this.set_oracle_account_idx(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_oracle_resume_args.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_oracle_resume_args, buffer, __tnParams);
  }

  static __tnInvokeFootprint(__tnParams: Record<string, bigint>): bigint {
    return this.__tnFootprintInternal(__tnParams);
  }

  static __tnInvokeValidate(buffer: Uint8Array, __tnParams: Record<string, bigint>): __TnValidateResult {
    return this.__tnValidateInternal(buffer, __tnParams);
  }

  static footprintIr(): bigint {
    return this.__tnFootprintInternal(Object.create(null));
  }

  static footprint(): number {
    const irResult = this.footprintIr();
      const maxSafe = __tnToBigInt(Number.MAX_SAFE_INTEGER);
    if (__tnBigIntGreaterThan(irResult, maxSafe)) {
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for oracle_resume_args');
    }
    return __tnBigIntToNumber(irResult, 'oracle_resume_args::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 6) return { ok: false, code: "tn.buffer_too_small", consumed: 6 };
    return { ok: true, consumed: 6 };
  }

  static new(instruction_type: number, oracle_account_idx: number): oracle_resume_args {
    const buffer = new Uint8Array(6);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, instruction_type, true); /* instruction_type (little-endian) */
    view.setUint16(4, oracle_account_idx, true); /* oracle_account_idx (little-endian) */

    return new oracle_resume_args(buffer);
  }

  static from_array(buffer: Uint8Array): oracle_resume_args | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new oracle_resume_args(buffer);
  }

}

export class oracle_resume_argsBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(6);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_oracle_account_idx(value: number): this {
    this.view.setUint16(4, value, true);
    return this;
  }

  build(): Uint8Array {
    return this.buffer.slice();
  }

  buildInto(target: Uint8Array, offset = 0): Uint8Array {
    if (target.length - offset < this.buffer.length) throw new Error("target buffer too small");
    target.set(this.buffer, offset);
    return target;
  }

  finish(): oracle_resume_args {
    const view = oracle_resume_args.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build oracle_resume_args");
    return view;
  }
}

__tnRegisterFootprint("oracle_resume_args", (params) => oracle_resume_args.__tnInvokeFootprint(params));
__tnRegisterValidate("oracle_resume_args", (buffer, params) => oracle_resume_args.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("oracle_resume_args", (buffer) => { const result = oracle_resume_args.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR oracle_update_hdr ----- */

const __tn_ir_oracle_update_hdr = {
  typeName: "oracle_update_hdr",
  root: { op: "const", value: 18n }
} as const;

export class oracle_update_hdr {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): oracle_update_hdr {
    if (!buffer || buffer.length === undefined) throw new Error("oracle_update_hdr.__tnCreateView requires a Uint8Array");
    return new oracle_update_hdr(new Uint8Array(buffer));
  }

  static builder(): oracle_update_hdrBuilder {
    return new oracle_update_hdrBuilder();
  }

  static fromBuilder(builder: oracle_update_hdrBuilder): oracle_update_hdr | null {
    const buffer = builder.build();
    return oracle_update_hdr.from_array(buffer);
  }

  get_instruction_type(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_instruction_type(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get instruction_type(): number {
    return this.get_instruction_type();
  }

  set instruction_type(value: number) {
    this.set_instruction_type(value);
  }

  get_oracle_account_idx(): number {
    const offset = 4;
    return this.view.getUint16(offset, true); /* little-endian */
  }

  set_oracle_account_idx(value: number): void {
    const offset = 4;
    this.view.setUint16(offset, value, true); /* little-endian */
  }

  get oracle_account_idx(): number {
    return this.get_oracle_account_idx();
  }

  set oracle_account_idx(value: number) {
    this.set_oracle_account_idx(value);
  }

  get_regime_id(): number {
    const offset = 6;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_regime_id(value: number): void {
    const offset = 6;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get regime_id(): number {
    return this.get_regime_id();
  }

  set regime_id(value: number) {
    this.set_regime_id(value);
  }

  get_timestamp(): number {
    const offset = 10;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_timestamp(value: number): void {
    const offset = 10;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get timestamp(): number {
    return this.get_timestamp();
  }

  set timestamp(value: number) {
    this.set_timestamp(value);
  }

  get_entry_count(): number {
    const offset = 14;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_entry_count(value: number): void {
    const offset = 14;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get entry_count(): number {
    return this.get_entry_count();
  }

  set entry_count(value: number) {
    this.set_entry_count(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_oracle_update_hdr.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_oracle_update_hdr, buffer, __tnParams);
  }

  static __tnInvokeFootprint(__tnParams: Record<string, bigint>): bigint {
    return this.__tnFootprintInternal(__tnParams);
  }

  static __tnInvokeValidate(buffer: Uint8Array, __tnParams: Record<string, bigint>): __TnValidateResult {
    return this.__tnValidateInternal(buffer, __tnParams);
  }

  static footprintIr(): bigint {
    return this.__tnFootprintInternal(Object.create(null));
  }

  static footprint(): number {
    const irResult = this.footprintIr();
      const maxSafe = __tnToBigInt(Number.MAX_SAFE_INTEGER);
    if (__tnBigIntGreaterThan(irResult, maxSafe)) {
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for oracle_update_hdr');
    }
    return __tnBigIntToNumber(irResult, 'oracle_update_hdr::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 18) return { ok: false, code: "tn.buffer_too_small", consumed: 18 };
    return { ok: true, consumed: 18 };
  }

  static new(instruction_type: number, oracle_account_idx: number, regime_id: number, timestamp: number, entry_count: number): oracle_update_hdr {
    const buffer = new Uint8Array(18);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, instruction_type, true); /* instruction_type (little-endian) */
    view.setUint16(4, oracle_account_idx, true); /* oracle_account_idx (little-endian) */
    view.setUint32(6, regime_id, true); /* regime_id (little-endian) */
    view.setUint32(10, timestamp, true); /* timestamp (little-endian) */
    view.setUint32(14, entry_count, true); /* entry_count (little-endian) */

    return new oracle_update_hdr(buffer);
  }

  static from_array(buffer: Uint8Array): oracle_update_hdr | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new oracle_update_hdr(buffer);
  }

}

export class oracle_update_hdrBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(18);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_oracle_account_idx(value: number): this {
    this.view.setUint16(4, value, true);
    return this;
  }

  set_regime_id(value: number): this {
    this.view.setUint32(6, value, true);
    return this;
  }

  set_timestamp(value: number): this {
    this.view.setUint32(10, value, true);
    return this;
  }

  set_entry_count(value: number): this {
    this.view.setUint32(14, value, true);
    return this;
  }

  build(): Uint8Array {
    return this.buffer.slice();
  }

  buildInto(target: Uint8Array, offset = 0): Uint8Array {
    if (target.length - offset < this.buffer.length) throw new Error("target buffer too small");
    target.set(this.buffer, offset);
    return target;
  }

  finish(): oracle_update_hdr {
    const view = oracle_update_hdr.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build oracle_update_hdr");
    return view;
  }
}

__tnRegisterFootprint("oracle_update_hdr", (params) => oracle_update_hdr.__tnInvokeFootprint(params));
__tnRegisterValidate("oracle_update_hdr", (buffer, params) => oracle_update_hdr.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("oracle_update_hdr", (buffer) => { const result = oracle_update_hdr.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR oracle_account_data ----- */

const __tn_ir_oracle_account_data = {
  typeName: "oracle_account_data",
  root: { op: "const", value: 948n }
} as const;

export class oracle_account_data {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): oracle_account_data {
    if (!buffer || buffer.length === undefined) throw new Error("oracle_account_data.__tnCreateView requires a Uint8Array");
    return new oracle_account_data(new Uint8Array(buffer));
  }

  static builder(): oracle_account_dataBuilder {
    return new oracle_account_dataBuilder();
  }

  static fromBuilder(builder: oracle_account_dataBuilder): oracle_account_data | null {
    const buffer = builder.build();
    return oracle_account_data.from_array(buffer);
  }

  get_version(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_version(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get version(): number {
    return this.get_version();
  }

  set version(value: number) {
    this.set_version(value);
  }

  get_authority_pubkey(): number[] {
    const offset = 4;
    const result: number[] = [];
    for (let i = 0; i < 32; i++) {
      result.push(this.view.getUint8((offset + i * 1)));
    }
    return result;
  }

  set_authority_pubkey(value: number[]): void {
    const offset = 4;
    if (value.length !== 32) {
      throw new Error('Array length must be 32');
    }
    for (let i = 0; i < 32; i++) {
      this.view.setUint8((offset + i * 1), value[i]);
    }
  }

  get authority_pubkey(): number[] {
    return this.get_authority_pubkey();
  }

  set authority_pubkey(value: number[]) {
    this.set_authority_pubkey(value);
  }

  get_circuit_breaker_active(): number {
    const offset = 36;
    return this.view.getUint8(offset);
  }

  set_circuit_breaker_active(value: number): void {
    const offset = 36;
    this.view.setUint8(offset, value);
  }

  get circuit_breaker_active(): number {
    return this.get_circuit_breaker_active();
  }

  set circuit_breaker_active(value: number) {
    this.set_circuit_breaker_active(value);
  }

  get__reserved(): number[] {
    const offset = 37;
    const result: number[] = [];
    for (let i = 0; i < 3; i++) {
      result.push(this.view.getUint8((offset + i * 1)));
    }
    return result;
  }

  set__reserved(value: number[]): void {
    const offset = 37;
    if (value.length !== 3) {
      throw new Error('Array length must be 3');
    }
    for (let i = 0; i < 3; i++) {
      this.view.setUint8((offset + i * 1), value[i]);
    }
  }

  get _reserved(): number[] {
    return this.get__reserved();
  }

  set _reserved(value: number[]) {
    this.set__reserved(value);
  }

  get_regime_id(): number {
    const offset = 40;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_regime_id(value: number): void {
    const offset = 40;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get regime_id(): number {
    return this.get_regime_id();
  }

  set regime_id(value: number) {
    this.set_regime_id(value);
  }

  get_last_update_ts(): number {
    const offset = 44;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_last_update_ts(value: number): void {
    const offset = 44;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get last_update_ts(): number {
    return this.get_last_update_ts();
  }

  set last_update_ts(value: number) {
    this.set_last_update_ts(value);
  }

  get_entry_count(): number {
    const offset = 48;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_entry_count(value: number): void {
    const offset = 48;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get entry_count(): number {
    return this.get_entry_count();
  }

  set entry_count(value: number) {
    this.set_entry_count(value);
  }

  get_entries(): oracle_entry[] {
    const offset = 52;
    const result: oracle_entry[] = [];
    for (let i = 0; i < 32; i++) {
      const slice = this.buffer.subarray((offset + i * 28), (offset + (i + 1) * 28));
      result.push(oracle_entry.from_array(slice)!);
    }
    return result;
  }

  set_entries(value: oracle_entry[]): void {
    const offset = 52;
    if (value.length !== 32) {
      throw new Error('Array length must be 32');
    }
    for (let i = 0; i < 32; i++) {
      const slice = this.buffer.subarray(offset + i * 28, offset + (i + 1) * 28);
      slice.set(value[i]['buffer']);
    }
  }

  get entries(): oracle_entry[] {
    return this.get_entries();
  }

  set entries(value: oracle_entry[]) {
    this.set_entries(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_oracle_account_data.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_oracle_account_data, buffer, __tnParams);
  }

  static __tnInvokeFootprint(__tnParams: Record<string, bigint>): bigint {
    return this.__tnFootprintInternal(__tnParams);
  }

  static __tnInvokeValidate(buffer: Uint8Array, __tnParams: Record<string, bigint>): __TnValidateResult {
    return this.__tnValidateInternal(buffer, __tnParams);
  }

  static footprintIr(): bigint {
    return this.__tnFootprintInternal(Object.create(null));
  }

  static footprint(): number {
    const irResult = this.footprintIr();
      const maxSafe = __tnToBigInt(Number.MAX_SAFE_INTEGER);
    if (__tnBigIntGreaterThan(irResult, maxSafe)) {
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for oracle_account_data');
    }
    return __tnBigIntToNumber(irResult, 'oracle_account_data::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 948) return { ok: false, code: "tn.buffer_too_small", consumed: 948 };
    return { ok: true, consumed: 948 };
  }

  static from_array(buffer: Uint8Array): oracle_account_data | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new oracle_account_data(buffer);
  }

}

export class oracle_account_dataBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(948);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_version(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_authority_pubkey(values: number[]): this {
    if (values.length !== 32) throw new Error("authority_pubkey expects 32 elements");
    for (let i = 0; i < values.length; i++) {
      const byteOffset = 4 + i * 1;
      this.view.setUint8(byteOffset, values[i]);
    }
    return this;
  }

  set_circuit_breaker_active(value: number): this {
    this.view.setUint8(36, value);
    return this;
  }

  set__reserved(values: number[]): this {
    if (values.length !== 3) throw new Error("_reserved expects 3 elements");
    for (let i = 0; i < values.length; i++) {
      const byteOffset = 37 + i * 1;
      this.view.setUint8(byteOffset, values[i]);
    }
    return this;
  }

  set_regime_id(value: number): this {
    this.view.setUint32(40, value, true);
    return this;
  }

  set_last_update_ts(value: number): this {
    this.view.setUint32(44, value, true);
    return this;
  }

  set_entry_count(value: number): this {
    this.view.setUint32(48, value, true);
    return this;
  }

  set_entries(values: oracle_entry[]): this {
    if (values.length !== 32) throw new Error("entries expects 32 elements");
    for (let i = 0; i < values.length; i++) {
      const slice = this.buffer.subarray(52 + i * 28, 52 + (i + 1) * 28);
      const source = values[i] as unknown as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number };
      const raw = source.buffer ? new Uint8Array(source.buffer, source.byteOffset ?? 0, 28) : (values[i] as unknown as Uint8Array);
      slice.set(raw);
    }
    return this;
  }

  build(): Uint8Array {
    return this.buffer.slice();
  }

  buildInto(target: Uint8Array, offset = 0): Uint8Array {
    if (target.length - offset < this.buffer.length) throw new Error("target buffer too small");
    target.set(this.buffer, offset);
    return target;
  }

  finish(): oracle_account_data {
    const view = oracle_account_data.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build oracle_account_data");
    return view;
  }
}

__tnRegisterFootprint("oracle_account_data", (params) => oracle_account_data.__tnInvokeFootprint(params));
__tnRegisterValidate("oracle_account_data", (buffer, params) => oracle_account_data.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("oracle_account_data", (buffer) => { const result = oracle_account_data.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });
