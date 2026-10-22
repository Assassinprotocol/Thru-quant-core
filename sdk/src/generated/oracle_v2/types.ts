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

/* ----- TYPE DEFINITION FOR aggregate_args ----- */

const __tn_ir_aggregate_args = {
  typeName: "aggregate_args",
  root: { op: "const", value: 8n }
} as const;

export class aggregate_args {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): aggregate_args {
    if (!buffer || buffer.length === undefined) throw new Error("aggregate_args.__tnCreateView requires a Uint8Array");
    return new aggregate_args(new Uint8Array(buffer));
  }

  static builder(): aggregate_argsBuilder {
    return new aggregate_argsBuilder();
  }

  static fromBuilder(builder: aggregate_argsBuilder): aggregate_args | null {
    const buffer = builder.build();
    return aggregate_args.from_array(buffer);
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

  get_symbol_id(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_symbol_id(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get symbol_id(): number {
    return this.get_symbol_id();
  }

  set symbol_id(value: number) {
    this.set_symbol_id(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_aggregate_args.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_aggregate_args, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for aggregate_args');
    }
    return __tnBigIntToNumber(irResult, 'aggregate_args::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 8) return { ok: false, code: "tn.buffer_too_small", consumed: 8 };
    return { ok: true, consumed: 8 };
  }

  static new(instruction_type: number, symbol_id: number): aggregate_args {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, instruction_type, true); /* instruction_type (little-endian) */
    view.setUint32(4, symbol_id, true); /* symbol_id (little-endian) */

    return new aggregate_args(buffer);
  }

  static from_array(buffer: Uint8Array): aggregate_args | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new aggregate_args(buffer);
  }

}

export class aggregate_argsBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(8);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_symbol_id(value: number): this {
    this.view.setUint32(4, value, true);
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

  finish(): aggregate_args {
    const view = aggregate_args.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build aggregate_args");
    return view;
  }
}

__tnRegisterFootprint("aggregate_args", (params) => aggregate_args.__tnInvokeFootprint(params));
__tnRegisterValidate("aggregate_args", (buffer, params) => aggregate_args.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("aggregate_args", (buffer) => { const result = aggregate_args.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR apply_config_args ----- */

const __tn_ir_apply_config_args = {
  typeName: "apply_config_args",
  root: { op: "const", value: 8n }
} as const;

export class apply_config_args {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): apply_config_args {
    if (!buffer || buffer.length === undefined) throw new Error("apply_config_args.__tnCreateView requires a Uint8Array");
    return new apply_config_args(new Uint8Array(buffer));
  }

  static builder(): apply_config_argsBuilder {
    return new apply_config_argsBuilder();
  }

  static fromBuilder(builder: apply_config_argsBuilder): apply_config_args | null {
    const buffer = builder.build();
    return apply_config_args.from_array(buffer);
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

  get_queue_index(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_queue_index(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get queue_index(): number {
    return this.get_queue_index();
  }

  set queue_index(value: number) {
    this.set_queue_index(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_apply_config_args.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_apply_config_args, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for apply_config_args');
    }
    return __tnBigIntToNumber(irResult, 'apply_config_args::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 8) return { ok: false, code: "tn.buffer_too_small", consumed: 8 };
    return { ok: true, consumed: 8 };
  }

  static new(instruction_type: number, queue_index: number): apply_config_args {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, instruction_type, true); /* instruction_type (little-endian) */
    view.setUint32(4, queue_index, true); /* queue_index (little-endian) */

    return new apply_config_args(buffer);
  }

  static from_array(buffer: Uint8Array): apply_config_args | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new apply_config_args(buffer);
  }

}

export class apply_config_argsBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(8);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_queue_index(value: number): this {
    this.view.setUint32(4, value, true);
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

  finish(): apply_config_args {
    const view = apply_config_args.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build apply_config_args");
    return view;
  }
}

__tnRegisterFootprint("apply_config_args", (params) => apply_config_args.__tnInvokeFootprint(params));
__tnRegisterValidate("apply_config_args", (buffer, params) => apply_config_args.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("apply_config_args", (buffer) => { const result = apply_config_args.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR emergency_pause_args ----- */

const __tn_ir_emergency_pause_args = {
  typeName: "emergency_pause_args",
  root: { op: "const", value: 8n }
} as const;

export class emergency_pause_args {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): emergency_pause_args {
    if (!buffer || buffer.length === undefined) throw new Error("emergency_pause_args.__tnCreateView requires a Uint8Array");
    return new emergency_pause_args(new Uint8Array(buffer));
  }

  static builder(): emergency_pause_argsBuilder {
    return new emergency_pause_argsBuilder();
  }

  static fromBuilder(builder: emergency_pause_argsBuilder): emergency_pause_args | null {
    const buffer = builder.build();
    return emergency_pause_args.from_array(buffer);
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

  get_symbol_id(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_symbol_id(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get symbol_id(): number {
    return this.get_symbol_id();
  }

  set symbol_id(value: number) {
    this.set_symbol_id(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_emergency_pause_args.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_emergency_pause_args, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for emergency_pause_args');
    }
    return __tnBigIntToNumber(irResult, 'emergency_pause_args::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 8) return { ok: false, code: "tn.buffer_too_small", consumed: 8 };
    return { ok: true, consumed: 8 };
  }

  static new(instruction_type: number, symbol_id: number): emergency_pause_args {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, instruction_type, true); /* instruction_type (little-endian) */
    view.setUint32(4, symbol_id, true); /* symbol_id (little-endian) */

    return new emergency_pause_args(buffer);
  }

  static from_array(buffer: Uint8Array): emergency_pause_args | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new emergency_pause_args(buffer);
  }

}

export class emergency_pause_argsBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(8);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_symbol_id(value: number): this {
    this.view.setUint32(4, value, true);
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

  finish(): emergency_pause_args {
    const view = emergency_pause_args.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build emergency_pause_args");
    return view;
  }
}

__tnRegisterFootprint("emergency_pause_args", (params) => emergency_pause_args.__tnInvokeFootprint(params));
__tnRegisterValidate("emergency_pause_args", (buffer, params) => emergency_pause_args.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("emergency_pause_args", (buffer) => { const result = emergency_pause_args.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR event_aggregate_updated ----- */

const __tn_ir_event_aggregate_updated = {
  typeName: "event_aggregate_updated",
  root: { op: "const", value: 40n }
} as const;

export class event_aggregate_updated {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): event_aggregate_updated {
    if (!buffer || buffer.length === undefined) throw new Error("event_aggregate_updated.__tnCreateView requires a Uint8Array");
    return new event_aggregate_updated(new Uint8Array(buffer));
  }

  static builder(): event_aggregate_updatedBuilder {
    return new event_aggregate_updatedBuilder();
  }

  static fromBuilder(builder: event_aggregate_updatedBuilder): event_aggregate_updated | null {
    const buffer = builder.build();
    return event_aggregate_updated.from_array(buffer);
  }

  get_event_type(): number {
    const offset = 0;
    return this.view.getUint8(offset);
  }

  set_event_type(value: number): void {
    const offset = 0;
    this.view.setUint8(offset, value);
  }

  get event_type(): number {
    return this.get_event_type();
  }

  set event_type(value: number) {
    this.set_event_type(value);
  }

  get_symbol_id(): number {
    const offset = 1;
    return this.view.getUint8(offset);
  }

  set_symbol_id(value: number): void {
    const offset = 1;
    this.view.setUint8(offset, value);
  }

  get symbol_id(): number {
    return this.get_symbol_id();
  }

  set symbol_id(value: number) {
    this.set_symbol_id(value);
  }

  get_flags(): number {
    const offset = 2;
    return this.view.getUint16(offset, true); /* little-endian */
  }

  set_flags(value: number): void {
    const offset = 2;
    this.view.setUint16(offset, value, true); /* little-endian */
  }

  get flags(): number {
    return this.get_flags();
  }

  set flags(value: number) {
    this.set_flags(value);
  }

  get_contributor_mask(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_contributor_mask(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get contributor_mask(): number {
    return this.get_contributor_mask();
  }

  set contributor_mask(value: number) {
    this.set_contributor_mask(value);
  }

  get_price(): bigint {
    const offset = 8;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_price(value: bigint): void {
    const offset = 8;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get price(): bigint {
    return this.get_price();
  }

  set price(value: bigint) {
    this.set_price(value);
  }

  get_confidence_bps(): bigint {
    const offset = 16;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_confidence_bps(value: bigint): void {
    const offset = 16;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get confidence_bps(): bigint {
    return this.get_confidence_bps();
  }

  set confidence_bps(value: bigint) {
    this.set_confidence_bps(value);
  }

  get_publish_slot(): bigint {
    const offset = 24;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_publish_slot(value: bigint): void {
    const offset = 24;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get publish_slot(): bigint {
    return this.get_publish_slot();
  }

  set publish_slot(value: bigint) {
    this.set_publish_slot(value);
  }

  get_median_source_ts(): bigint {
    const offset = 32;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_median_source_ts(value: bigint): void {
    const offset = 32;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get median_source_ts(): bigint {
    return this.get_median_source_ts();
  }

  set median_source_ts(value: bigint) {
    this.set_median_source_ts(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_event_aggregate_updated.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_event_aggregate_updated, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for event_aggregate_updated');
    }
    return __tnBigIntToNumber(irResult, 'event_aggregate_updated::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 40) return { ok: false, code: "tn.buffer_too_small", consumed: 40 };
    return { ok: true, consumed: 40 };
  }

  static new(event_type: number, symbol_id: number, flags: number, contributor_mask: number, price: bigint, confidence_bps: bigint, publish_slot: bigint, median_source_ts: bigint): event_aggregate_updated {
    const buffer = new Uint8Array(40);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint8(0, event_type); /* event_type */
    view.setUint8(1, symbol_id); /* symbol_id */
    view.setUint16(2, flags, true); /* flags (little-endian) */
    view.setUint32(4, contributor_mask, true); /* contributor_mask (little-endian) */
    view.setBigUint64(8, price, true); /* price (little-endian) */
    view.setBigUint64(16, confidence_bps, true); /* confidence_bps (little-endian) */
    view.setBigUint64(24, publish_slot, true); /* publish_slot (little-endian) */
    view.setBigUint64(32, median_source_ts, true); /* median_source_ts (little-endian) */

    return new event_aggregate_updated(buffer);
  }

  static from_array(buffer: Uint8Array): event_aggregate_updated | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new event_aggregate_updated(buffer);
  }

}

export class event_aggregate_updatedBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(40);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_event_type(value: number): this {
    this.view.setUint8(0, value);
    return this;
  }

  set_symbol_id(value: number): this {
    this.view.setUint8(1, value);
    return this;
  }

  set_flags(value: number): this {
    this.view.setUint16(2, value, true);
    return this;
  }

  set_contributor_mask(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_price(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(8, cast, true);
    return this;
  }

  set_confidence_bps(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(16, cast, true);
    return this;
  }

  set_publish_slot(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(24, cast, true);
    return this;
  }

  set_median_source_ts(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(32, cast, true);
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

  finish(): event_aggregate_updated {
    const view = event_aggregate_updated.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build event_aggregate_updated");
    return view;
  }
}

__tnRegisterFootprint("event_aggregate_updated", (params) => event_aggregate_updated.__tnInvokeFootprint(params));
__tnRegisterValidate("event_aggregate_updated", (buffer, params) => event_aggregate_updated.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("event_aggregate_updated", (buffer) => { const result = event_aggregate_updated.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR feed_account_data ----- */

const __tn_ir_feed_account_data = {
  typeName: "feed_account_data",
  root: { op: "const", value: 80n }
} as const;

export class feed_account_data {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): feed_account_data {
    if (!buffer || buffer.length === undefined) throw new Error("feed_account_data.__tnCreateView requires a Uint8Array");
    return new feed_account_data(new Uint8Array(buffer));
  }

  static builder(): feed_account_dataBuilder {
    return new feed_account_dataBuilder();
  }

  static fromBuilder(builder: feed_account_dataBuilder): feed_account_data | null {
    const buffer = builder.build();
    return feed_account_data.from_array(buffer);
  }

  get_magic(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_magic(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get magic(): number {
    return this.get_magic();
  }

  set magic(value: number) {
    this.set_magic(value);
  }

  get_version(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_version(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get version(): number {
    return this.get_version();
  }

  set version(value: number) {
    this.set_version(value);
  }

  get_symbol_id(): number {
    const offset = 8;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_symbol_id(value: number): void {
    const offset = 8;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get symbol_id(): number {
    return this.get_symbol_id();
  }

  set symbol_id(value: number) {
    this.set_symbol_id(value);
  }

  get_status(): number {
    const offset = 12;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_status(value: number): void {
    const offset = 12;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get status(): number {
    return this.get_status();
  }

  set status(value: number) {
    this.set_status(value);
  }

  get_price(): bigint {
    const offset = 16;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_price(value: bigint): void {
    const offset = 16;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get price(): bigint {
    return this.get_price();
  }

  set price(value: bigint) {
    this.set_price(value);
  }

  get_prev_price(): bigint {
    const offset = 24;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_prev_price(value: bigint): void {
    const offset = 24;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get prev_price(): bigint {
    return this.get_prev_price();
  }

  set prev_price(value: bigint) {
    this.set_prev_price(value);
  }

  get_confidence_bps(): bigint {
    const offset = 32;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_confidence_bps(value: bigint): void {
    const offset = 32;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get confidence_bps(): bigint {
    return this.get_confidence_bps();
  }

  set confidence_bps(value: bigint) {
    this.set_confidence_bps(value);
  }

  get_publish_slot(): bigint {
    const offset = 40;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_publish_slot(value: bigint): void {
    const offset = 40;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get publish_slot(): bigint {
    return this.get_publish_slot();
  }

  set publish_slot(value: bigint) {
    this.set_publish_slot(value);
  }

  get_prev_publish_slot(): bigint {
    const offset = 48;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_prev_publish_slot(value: bigint): void {
    const offset = 48;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get prev_publish_slot(): bigint {
    return this.get_prev_publish_slot();
  }

  set prev_publish_slot(value: bigint) {
    this.set_prev_publish_slot(value);
  }

  get_median_source_ts(): bigint {
    const offset = 56;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_median_source_ts(value: bigint): void {
    const offset = 56;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get median_source_ts(): bigint {
    return this.get_median_source_ts();
  }

  set median_source_ts(value: bigint) {
    this.set_median_source_ts(value);
  }

  get_contributor_count(): number {
    const offset = 64;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_contributor_count(value: number): void {
    const offset = 64;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get contributor_count(): number {
    return this.get_contributor_count();
  }

  set contributor_count(value: number) {
    this.set_contributor_count(value);
  }

  get_flags(): number {
    const offset = 68;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_flags(value: number): void {
    const offset = 68;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get flags(): number {
    return this.get_flags();
  }

  set flags(value: number) {
    this.set_flags(value);
  }

  get_contributor_mask(): number {
    const offset = 72;
    return this.view.getUint8(offset);
  }

  set_contributor_mask(value: number): void {
    const offset = 72;
    this.view.setUint8(offset, value);
  }

  get contributor_mask(): number {
    return this.get_contributor_mask();
  }

  set contributor_mask(value: number) {
    this.set_contributor_mask(value);
  }

  get_reserved(): number[] {
    const offset = 73;
    const result: number[] = [];
    for (let i = 0; i < 7; i++) {
      result.push(this.view.getUint8((offset + i * 1)));
    }
    return result;
  }

  set_reserved(value: number[]): void {
    const offset = 73;
    if (value.length !== 7) {
      throw new Error('Array length must be 7');
    }
    for (let i = 0; i < 7; i++) {
      this.view.setUint8((offset + i * 1), value[i]);
    }
  }

  get reserved(): number[] {
    return this.get_reserved();
  }

  set reserved(value: number[]) {
    this.set_reserved(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_feed_account_data.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_feed_account_data, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for feed_account_data');
    }
    return __tnBigIntToNumber(irResult, 'feed_account_data::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 80) return { ok: false, code: "tn.buffer_too_small", consumed: 80 };
    return { ok: true, consumed: 80 };
  }

  static from_array(buffer: Uint8Array): feed_account_data | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new feed_account_data(buffer);
  }

}

export class feed_account_dataBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(80);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_magic(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_version(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_symbol_id(value: number): this {
    this.view.setUint32(8, value, true);
    return this;
  }

  set_status(value: number): this {
    this.view.setUint32(12, value, true);
    return this;
  }

  set_price(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(16, cast, true);
    return this;
  }

  set_prev_price(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(24, cast, true);
    return this;
  }

  set_confidence_bps(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(32, cast, true);
    return this;
  }

  set_publish_slot(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(40, cast, true);
    return this;
  }

  set_prev_publish_slot(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(48, cast, true);
    return this;
  }

  set_median_source_ts(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(56, cast, true);
    return this;
  }

  set_contributor_count(value: number): this {
    this.view.setUint32(64, value, true);
    return this;
  }

  set_flags(value: number): this {
    this.view.setUint32(68, value, true);
    return this;
  }

  set_contributor_mask(value: number): this {
    this.view.setUint8(72, value);
    return this;
  }

  set_reserved(values: number[]): this {
    if (values.length !== 7) throw new Error("reserved expects 7 elements");
    for (let i = 0; i < values.length; i++) {
      const byteOffset = 73 + i * 1;
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

  finish(): feed_account_data {
    const view = feed_account_data.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build feed_account_data");
    return view;
  }
}

__tnRegisterFootprint("feed_account_data", (params) => feed_account_data.__tnInvokeFootprint(params));
__tnRegisterValidate("feed_account_data", (buffer, params) => feed_account_data.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("feed_account_data", (buffer) => { const result = feed_account_data.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR feed_config ----- */

const __tn_ir_feed_config = {
  typeName: "feed_config",
  root: { op: "const", value: 24n }
} as const;

export class feed_config {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): feed_config {
    if (!buffer || buffer.length === undefined) throw new Error("feed_config.__tnCreateView requires a Uint8Array");
    return new feed_config(new Uint8Array(buffer));
  }

  static builder(): feed_configBuilder {
    return new feed_configBuilder();
  }

  static fromBuilder(builder: feed_configBuilder): feed_config | null {
    const buffer = builder.build();
    return feed_config.from_array(buffer);
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

  get_status(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_status(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get status(): number {
    return this.get_status();
  }

  set status(value: number) {
    this.set_status(value);
  }

  get_outlier_bps(): number {
    const offset = 8;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_outlier_bps(value: number): void {
    const offset = 8;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get outlier_bps(): number {
    return this.get_outlier_bps();
  }

  set outlier_bps(value: number) {
    this.set_outlier_bps(value);
  }

  get_max_staleness_slots(): number {
    const offset = 12;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_max_staleness_slots(value: number): void {
    const offset = 12;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get max_staleness_slots(): number {
    return this.get_max_staleness_slots();
  }

  set max_staleness_slots(value: number) {
    this.set_max_staleness_slots(value);
  }

  get_big_move_bps(): number {
    const offset = 16;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_big_move_bps(value: number): void {
    const offset = 16;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get big_move_bps(): number {
    return this.get_big_move_bps();
  }

  set big_move_bps(value: number) {
    this.set_big_move_bps(value);
  }

  get_reserved(): number {
    const offset = 20;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_reserved(value: number): void {
    const offset = 20;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get reserved(): number {
    return this.get_reserved();
  }

  set reserved(value: number) {
    this.set_reserved(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_feed_config.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_feed_config, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for feed_config');
    }
    return __tnBigIntToNumber(irResult, 'feed_config::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 24) return { ok: false, code: "tn.buffer_too_small", consumed: 24 };
    return { ok: true, consumed: 24 };
  }

  static new(symbol_id: number, status: number, outlier_bps: number, max_staleness_slots: number, big_move_bps: number, reserved: number): feed_config {
    const buffer = new Uint8Array(24);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, symbol_id, true); /* symbol_id (little-endian) */
    view.setUint32(4, status, true); /* status (little-endian) */
    view.setUint32(8, outlier_bps, true); /* outlier_bps (little-endian) */
    view.setUint32(12, max_staleness_slots, true); /* max_staleness_slots (little-endian) */
    view.setUint32(16, big_move_bps, true); /* big_move_bps (little-endian) */
    view.setUint32(20, reserved, true); /* reserved (little-endian) */

    return new feed_config(buffer);
  }

  static from_array(buffer: Uint8Array): feed_config | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new feed_config(buffer);
  }

}

export class feed_configBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(24);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_symbol_id(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_status(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_outlier_bps(value: number): this {
    this.view.setUint32(8, value, true);
    return this;
  }

  set_max_staleness_slots(value: number): this {
    this.view.setUint32(12, value, true);
    return this;
  }

  set_big_move_bps(value: number): this {
    this.view.setUint32(16, value, true);
    return this;
  }

  set_reserved(value: number): this {
    this.view.setUint32(20, value, true);
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

  finish(): feed_config {
    const view = feed_config.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build feed_config");
    return view;
  }
}

__tnRegisterFootprint("feed_config", (params) => feed_config.__tnInvokeFootprint(params));
__tnRegisterValidate("feed_config", (buffer, params) => feed_config.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("feed_config", (buffer) => { const result = feed_config.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR pubkey_bytes ----- */

const __tn_ir_pubkey_bytes = {
  typeName: "pubkey_bytes",
  root: { op: "const", value: 32n }
} as const;

export class pubkey_bytes {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): pubkey_bytes {
    if (!buffer || buffer.length === undefined) throw new Error("pubkey_bytes.__tnCreateView requires a Uint8Array");
    return new pubkey_bytes(new Uint8Array(buffer));
  }

  static builder(): pubkey_bytesBuilder {
    return new pubkey_bytesBuilder();
  }

  static fromBuilder(builder: pubkey_bytesBuilder): pubkey_bytes | null {
    const buffer = builder.build();
    return pubkey_bytes.from_array(buffer);
  }

  get_data(): number[] {
    const offset = 0;
    const result: number[] = [];
    for (let i = 0; i < 32; i++) {
      result.push(this.view.getUint8((offset + i * 1)));
    }
    return result;
  }

  set_data(value: number[]): void {
    const offset = 0;
    if (value.length !== 32) {
      throw new Error('Array length must be 32');
    }
    for (let i = 0; i < 32; i++) {
      this.view.setUint8((offset + i * 1), value[i]);
    }
  }

  get data(): number[] {
    return this.get_data();
  }

  set data(value: number[]) {
    this.set_data(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_pubkey_bytes.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_pubkey_bytes, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for pubkey_bytes');
    }
    return __tnBigIntToNumber(irResult, 'pubkey_bytes::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 32) return { ok: false, code: "tn.buffer_too_small", consumed: 32 };
    return { ok: true, consumed: 32 };
  }

  static from_array(buffer: Uint8Array): pubkey_bytes | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new pubkey_bytes(buffer);
  }

}

export class pubkey_bytesBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(32);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_data(values: number[]): this {
    if (values.length !== 32) throw new Error("data expects 32 elements");
    for (let i = 0; i < values.length; i++) {
      const byteOffset = 0 + i * 1;
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

  finish(): pubkey_bytes {
    const view = pubkey_bytes.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build pubkey_bytes");
    return view;
  }
}

__tnRegisterFootprint("pubkey_bytes", (params) => pubkey_bytes.__tnInvokeFootprint(params));
__tnRegisterValidate("pubkey_bytes", (buffer, params) => pubkey_bytes.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("pubkey_bytes", (buffer) => { const result = pubkey_bytes.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR publisher_desc ----- */

const __tn_ir_publisher_desc = {
  typeName: "publisher_desc",
  root: { op: "const", value: 48n }
} as const;

export class publisher_desc {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): publisher_desc {
    if (!buffer || buffer.length === undefined) throw new Error("publisher_desc.__tnCreateView requires a Uint8Array");
    return new publisher_desc(new Uint8Array(buffer));
  }

  static builder(): publisher_descBuilder {
    return new publisher_descBuilder();
  }

  static fromBuilder(builder: publisher_descBuilder): publisher_desc | null {
    const buffer = builder.build();
    return publisher_desc.from_array(buffer);
  }

  get_pubkey(): pubkey_bytes {
    const offset = 0;
    const slice = this.buffer.subarray(offset, offset + 32);
    return pubkey_bytes.from_array(slice)!;
  }

  set_pubkey(value: pubkey_bytes): void {
    /* Copy bytes from source struct to this field */
    const sourceBytes = (value as any).buffer as Uint8Array;
    const offset = 0;
    this.buffer.set(sourceBytes, offset);
  }

  get pubkey(): pubkey_bytes {
    return this.get_pubkey();
  }

  set pubkey(value: pubkey_bytes) {
    this.set_pubkey(value);
  }

  get_status(): number {
    const offset = 32;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_status(value: number): void {
    const offset = 32;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get status(): number {
    return this.get_status();
  }

  set status(value: number) {
    this.set_status(value);
  }

  get_weight(): number {
    const offset = 36;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_weight(value: number): void {
    const offset = 36;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get weight(): number {
    return this.get_weight();
  }

  set weight(value: number) {
    this.set_weight(value);
  }

  get_last_submission_slot(): bigint {
    const offset = 40;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_last_submission_slot(value: bigint): void {
    const offset = 40;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get last_submission_slot(): bigint {
    return this.get_last_submission_slot();
  }

  set last_submission_slot(value: bigint) {
    this.set_last_submission_slot(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_publisher_desc.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_publisher_desc, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for publisher_desc');
    }
    return __tnBigIntToNumber(irResult, 'publisher_desc::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 48) return { ok: false, code: "tn.buffer_too_small", consumed: 48 };
    return { ok: true, consumed: 48 };
  }

  static from_array(buffer: Uint8Array): publisher_desc | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new publisher_desc(buffer);
  }

}

export class publisher_descBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(48);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_pubkey(value: Uint8Array): this {
    if (value.length !== 32) throw new Error("pubkey expects 32 bytes");
    this.buffer.set(value, 0);
    return this;
  }

  set_status(value: number): this {
    this.view.setUint32(32, value, true);
    return this;
  }

  set_weight(value: number): this {
    this.view.setUint32(36, value, true);
    return this;
  }

  set_last_submission_slot(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(40, cast, true);
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

  finish(): publisher_desc {
    const view = publisher_desc.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build publisher_desc");
    return view;
  }
}

__tnRegisterFootprint("publisher_desc", (params) => publisher_desc.__tnInvokeFootprint(params));
__tnRegisterValidate("publisher_desc", (buffer, params) => publisher_desc.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("publisher_desc", (buffer) => { const result = publisher_desc.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR queue_config_args ----- */

const __tn_ir_queue_config_args = {
  typeName: "queue_config_args",
  root: { op: "const", value: 20n }
} as const;

export class queue_config_args {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): queue_config_args {
    if (!buffer || buffer.length === undefined) throw new Error("queue_config_args.__tnCreateView requires a Uint8Array");
    return new queue_config_args(new Uint8Array(buffer));
  }

  static builder(): queue_config_argsBuilder {
    return new queue_config_argsBuilder();
  }

  static fromBuilder(builder: queue_config_argsBuilder): queue_config_args | null {
    const buffer = builder.build();
    return queue_config_args.from_array(buffer);
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

  get_action_id(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_action_id(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get action_id(): number {
    return this.get_action_id();
  }

  set action_id(value: number) {
    this.set_action_id(value);
  }

  get_target_id(): number {
    const offset = 8;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_target_id(value: number): void {
    const offset = 8;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get target_id(): number {
    return this.get_target_id();
  }

  set target_id(value: number) {
    this.set_target_id(value);
  }

  get_param_val(): bigint {
    const offset = 12;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_param_val(value: bigint): void {
    const offset = 12;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get param_val(): bigint {
    return this.get_param_val();
  }

  set param_val(value: bigint) {
    this.set_param_val(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_queue_config_args.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_queue_config_args, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for queue_config_args');
    }
    return __tnBigIntToNumber(irResult, 'queue_config_args::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 20) return { ok: false, code: "tn.buffer_too_small", consumed: 20 };
    return { ok: true, consumed: 20 };
  }

  static new(instruction_type: number, action_id: number, target_id: number, param_val: bigint): queue_config_args {
    const buffer = new Uint8Array(20);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, instruction_type, true); /* instruction_type (little-endian) */
    view.setUint32(4, action_id, true); /* action_id (little-endian) */
    view.setUint32(8, target_id, true); /* target_id (little-endian) */
    view.setBigUint64(12, param_val, true); /* param_val (little-endian) */

    return new queue_config_args(buffer);
  }

  static from_array(buffer: Uint8Array): queue_config_args | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new queue_config_args(buffer);
  }

}

export class queue_config_argsBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(20);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_action_id(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_target_id(value: number): this {
    this.view.setUint32(8, value, true);
    return this;
  }

  set_param_val(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(12, cast, true);
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

  finish(): queue_config_args {
    const view = queue_config_args.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build queue_config_args");
    return view;
  }
}

__tnRegisterFootprint("queue_config_args", (params) => queue_config_args.__tnInvokeFootprint(params));
__tnRegisterValidate("queue_config_args", (buffer, params) => queue_config_args.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("queue_config_args", (buffer) => { const result = queue_config_args.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR raw_quote ----- */

const __tn_ir_raw_quote = {
  typeName: "raw_quote",
  root: { op: "const", value: 24n }
} as const;

export class raw_quote {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): raw_quote {
    if (!buffer || buffer.length === undefined) throw new Error("raw_quote.__tnCreateView requires a Uint8Array");
    return new raw_quote(new Uint8Array(buffer));
  }

  static builder(): raw_quoteBuilder {
    return new raw_quoteBuilder();
  }

  static fromBuilder(builder: raw_quoteBuilder): raw_quote | null {
    const buffer = builder.build();
    return raw_quote.from_array(buffer);
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

  get_reserved(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_reserved(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get reserved(): number {
    return this.get_reserved();
  }

  set reserved(value: number) {
    this.set_reserved(value);
  }

  get_price(): bigint {
    const offset = 8;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_price(value: bigint): void {
    const offset = 8;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get price(): bigint {
    return this.get_price();
  }

  set price(value: bigint) {
    this.set_price(value);
  }

  get_source_ts(): bigint {
    const offset = 16;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_source_ts(value: bigint): void {
    const offset = 16;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get source_ts(): bigint {
    return this.get_source_ts();
  }

  set source_ts(value: bigint) {
    this.set_source_ts(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_raw_quote.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_raw_quote, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for raw_quote');
    }
    return __tnBigIntToNumber(irResult, 'raw_quote::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 24) return { ok: false, code: "tn.buffer_too_small", consumed: 24 };
    return { ok: true, consumed: 24 };
  }

  static new(symbol_id: number, reserved: number, price: bigint, source_ts: bigint): raw_quote {
    const buffer = new Uint8Array(24);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, symbol_id, true); /* symbol_id (little-endian) */
    view.setUint32(4, reserved, true); /* reserved (little-endian) */
    view.setBigUint64(8, price, true); /* price (little-endian) */
    view.setBigUint64(16, source_ts, true); /* source_ts (little-endian) */

    return new raw_quote(buffer);
  }

  static from_array(buffer: Uint8Array): raw_quote | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new raw_quote(buffer);
  }

}

export class raw_quoteBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(24);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_symbol_id(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_reserved(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_price(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(8, cast, true);
    return this;
  }

  set_source_ts(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(16, cast, true);
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

  finish(): raw_quote {
    const view = raw_quote.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build raw_quote");
    return view;
  }
}

__tnRegisterFootprint("raw_quote", (params) => raw_quote.__tnInvokeFootprint(params));
__tnRegisterValidate("raw_quote", (buffer, params) => raw_quote.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("raw_quote", (buffer) => { const result = raw_quote.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR set_publisher_args ----- */

const __tn_ir_set_publisher_args = {
  typeName: "set_publisher_args",
  root: { op: "const", value: 40n }
} as const;

export class set_publisher_args {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): set_publisher_args {
    if (!buffer || buffer.length === undefined) throw new Error("set_publisher_args.__tnCreateView requires a Uint8Array");
    return new set_publisher_args(new Uint8Array(buffer));
  }

  static builder(): set_publisher_argsBuilder {
    return new set_publisher_argsBuilder();
  }

  static fromBuilder(builder: set_publisher_argsBuilder): set_publisher_args | null {
    const buffer = builder.build();
    return set_publisher_args.from_array(buffer);
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

  get_publisher_pubkey(): pubkey_bytes {
    const offset = 4;
    const slice = this.buffer.subarray(offset, offset + 32);
    return pubkey_bytes.from_array(slice)!;
  }

  set_publisher_pubkey(value: pubkey_bytes): void {
    /* Copy bytes from source struct to this field */
    const sourceBytes = (value as any).buffer as Uint8Array;
    const offset = 4;
    this.buffer.set(sourceBytes, offset);
  }

  get publisher_pubkey(): pubkey_bytes {
    return this.get_publisher_pubkey();
  }

  set publisher_pubkey(value: pubkey_bytes) {
    this.set_publisher_pubkey(value);
  }

  get_status(): number {
    const offset = 36;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_status(value: number): void {
    const offset = 36;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get status(): number {
    return this.get_status();
  }

  set status(value: number) {
    this.set_status(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_set_publisher_args.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_set_publisher_args, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for set_publisher_args');
    }
    return __tnBigIntToNumber(irResult, 'set_publisher_args::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 40) return { ok: false, code: "tn.buffer_too_small", consumed: 40 };
    return { ok: true, consumed: 40 };
  }

  static from_array(buffer: Uint8Array): set_publisher_args | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new set_publisher_args(buffer);
  }

}

export class set_publisher_argsBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(40);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_publisher_pubkey(value: Uint8Array): this {
    if (value.length !== 32) throw new Error("publisher_pubkey expects 32 bytes");
    this.buffer.set(value, 4);
    return this;
  }

  set_status(value: number): this {
    this.view.setUint32(36, value, true);
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

  finish(): set_publisher_args {
    const view = set_publisher_args.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build set_publisher_args");
    return view;
  }
}

__tnRegisterFootprint("set_publisher_args", (params) => set_publisher_args.__tnInvokeFootprint(params));
__tnRegisterValidate("set_publisher_args", (buffer, params) => set_publisher_args.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("set_publisher_args", (buffer) => { const result = set_publisher_args.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR submission_account_data ----- */

const __tn_ir_submission_account_data = {
  typeName: "submission_account_data",
  root: { op: "const", value: 832n }
} as const;

export class submission_account_data {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): submission_account_data {
    if (!buffer || buffer.length === undefined) throw new Error("submission_account_data.__tnCreateView requires a Uint8Array");
    return new submission_account_data(new Uint8Array(buffer));
  }

  static builder(): submission_account_dataBuilder {
    return new submission_account_dataBuilder();
  }

  static fromBuilder(builder: submission_account_dataBuilder): submission_account_data | null {
    const buffer = builder.build();
    return submission_account_data.from_array(buffer);
  }

  get_magic(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_magic(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get magic(): number {
    return this.get_magic();
  }

  set magic(value: number) {
    this.set_magic(value);
  }

  get_version(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_version(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get version(): number {
    return this.get_version();
  }

  set version(value: number) {
    this.set_version(value);
  }

  get_publisher_pubkey(): pubkey_bytes {
    const offset = 8;
    const slice = this.buffer.subarray(offset, offset + 32);
    return pubkey_bytes.from_array(slice)!;
  }

  set_publisher_pubkey(value: pubkey_bytes): void {
    /* Copy bytes from source struct to this field */
    const sourceBytes = (value as any).buffer as Uint8Array;
    const offset = 8;
    this.buffer.set(sourceBytes, offset);
  }

  get publisher_pubkey(): pubkey_bytes {
    return this.get_publisher_pubkey();
  }

  set publisher_pubkey(value: pubkey_bytes) {
    this.set_publisher_pubkey(value);
  }

  get_sequence_number(): bigint {
    const offset = 40;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_sequence_number(value: bigint): void {
    const offset = 40;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get sequence_number(): bigint {
    return this.get_sequence_number();
  }

  set sequence_number(value: bigint) {
    this.set_sequence_number(value);
  }

  get_publish_slot(): bigint {
    const offset = 48;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_publish_slot(value: bigint): void {
    const offset = 48;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get publish_slot(): bigint {
    return this.get_publish_slot();
  }

  set publish_slot(value: bigint) {
    this.set_publish_slot(value);
  }

  get_quote_count(): number {
    const offset = 56;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_quote_count(value: number): void {
    const offset = 56;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get quote_count(): number {
    return this.get_quote_count();
  }

  set quote_count(value: number) {
    this.set_quote_count(value);
  }

  get_flags(): number {
    const offset = 60;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_flags(value: number): void {
    const offset = 60;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get flags(): number {
    return this.get_flags();
  }

  set flags(value: number) {
    this.set_flags(value);
  }

  get_quotes(): raw_quote[] {
    const offset = 64;
    const result: raw_quote[] = [];
    for (let i = 0; i < 32; i++) {
      const slice = this.buffer.subarray((offset + i * 24), (offset + (i + 1) * 24));
      result.push(raw_quote.from_array(slice)!);
    }
    return result;
  }

  set_quotes(value: raw_quote[]): void {
    const offset = 64;
    if (value.length !== 32) {
      throw new Error('Array length must be 32');
    }
    for (let i = 0; i < 32; i++) {
      const slice = this.buffer.subarray(offset + i * 24, offset + (i + 1) * 24);
      slice.set(value[i]['buffer']);
    }
  }

  get quotes(): raw_quote[] {
    return this.get_quotes();
  }

  set quotes(value: raw_quote[]) {
    this.set_quotes(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_submission_account_data.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_submission_account_data, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for submission_account_data');
    }
    return __tnBigIntToNumber(irResult, 'submission_account_data::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 832) return { ok: false, code: "tn.buffer_too_small", consumed: 832 };
    return { ok: true, consumed: 832 };
  }

  static from_array(buffer: Uint8Array): submission_account_data | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new submission_account_data(buffer);
  }

}

export class submission_account_dataBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(832);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_magic(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_version(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_publisher_pubkey(value: Uint8Array): this {
    if (value.length !== 32) throw new Error("publisher_pubkey expects 32 bytes");
    this.buffer.set(value, 8);
    return this;
  }

  set_sequence_number(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(40, cast, true);
    return this;
  }

  set_publish_slot(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(48, cast, true);
    return this;
  }

  set_quote_count(value: number): this {
    this.view.setUint32(56, value, true);
    return this;
  }

  set_flags(value: number): this {
    this.view.setUint32(60, value, true);
    return this;
  }

  set_quotes(values: raw_quote[]): this {
    if (values.length !== 32) throw new Error("quotes expects 32 elements");
    for (let i = 0; i < values.length; i++) {
      const slice = this.buffer.subarray(64 + i * 24, 64 + (i + 1) * 24);
      const source = values[i] as unknown as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number };
      const raw = source.buffer ? new Uint8Array(source.buffer, source.byteOffset ?? 0, 24) : (values[i] as unknown as Uint8Array);
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

  finish(): submission_account_data {
    const view = submission_account_data.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build submission_account_data");
    return view;
  }
}

__tnRegisterFootprint("submission_account_data", (params) => submission_account_data.__tnInvokeFootprint(params));
__tnRegisterValidate("submission_account_data", (buffer, params) => submission_account_data.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("submission_account_data", (buffer) => { const result = submission_account_data.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR submit_prices_hdr ----- */

const __tn_ir_submit_prices_hdr = {
  typeName: "submit_prices_hdr",
  root: { op: "const", value: 8n }
} as const;

export class submit_prices_hdr {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): submit_prices_hdr {
    if (!buffer || buffer.length === undefined) throw new Error("submit_prices_hdr.__tnCreateView requires a Uint8Array");
    return new submit_prices_hdr(new Uint8Array(buffer));
  }

  static builder(): submit_prices_hdrBuilder {
    return new submit_prices_hdrBuilder();
  }

  static fromBuilder(builder: submit_prices_hdrBuilder): submit_prices_hdr | null {
    const buffer = builder.build();
    return submit_prices_hdr.from_array(buffer);
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

  get_quote_count(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_quote_count(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get quote_count(): number {
    return this.get_quote_count();
  }

  set quote_count(value: number) {
    this.set_quote_count(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_submit_prices_hdr.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_submit_prices_hdr, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for submit_prices_hdr');
    }
    return __tnBigIntToNumber(irResult, 'submit_prices_hdr::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 8) return { ok: false, code: "tn.buffer_too_small", consumed: 8 };
    return { ok: true, consumed: 8 };
  }

  static new(instruction_type: number, quote_count: number): submit_prices_hdr {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, instruction_type, true); /* instruction_type (little-endian) */
    view.setUint32(4, quote_count, true); /* quote_count (little-endian) */

    return new submit_prices_hdr(buffer);
  }

  static from_array(buffer: Uint8Array): submit_prices_hdr | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new submit_prices_hdr(buffer);
  }

}

export class submit_prices_hdrBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(8);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_quote_count(value: number): this {
    this.view.setUint32(4, value, true);
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

  finish(): submit_prices_hdr {
    const view = submit_prices_hdr.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build submit_prices_hdr");
    return view;
  }
}

__tnRegisterFootprint("submit_prices_hdr", (params) => submit_prices_hdr.__tnInvokeFootprint(params));
__tnRegisterValidate("submit_prices_hdr", (buffer, params) => submit_prices_hdr.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("submit_prices_hdr", (buffer) => { const result = submit_prices_hdr.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR timelock_entry ----- */

const __tn_ir_timelock_entry = {
  typeName: "timelock_entry",
  root: { op: "const", value: 24n }
} as const;

export class timelock_entry {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): timelock_entry {
    if (!buffer || buffer.length === undefined) throw new Error("timelock_entry.__tnCreateView requires a Uint8Array");
    return new timelock_entry(new Uint8Array(buffer));
  }

  static builder(): timelock_entryBuilder {
    return new timelock_entryBuilder();
  }

  static fromBuilder(builder: timelock_entryBuilder): timelock_entry | null {
    const buffer = builder.build();
    return timelock_entry.from_array(buffer);
  }

  get_action_id(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_action_id(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get action_id(): number {
    return this.get_action_id();
  }

  set action_id(value: number) {
    this.set_action_id(value);
  }

  get_target_id(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_target_id(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get target_id(): number {
    return this.get_target_id();
  }

  set target_id(value: number) {
    this.set_target_id(value);
  }

  get_param_val(): bigint {
    const offset = 8;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_param_val(value: bigint): void {
    const offset = 8;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get param_val(): bigint {
    return this.get_param_val();
  }

  set param_val(value: bigint) {
    this.set_param_val(value);
  }

  get_unlock_timestamp(): bigint {
    const offset = 16;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_unlock_timestamp(value: bigint): void {
    const offset = 16;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get unlock_timestamp(): bigint {
    return this.get_unlock_timestamp();
  }

  set unlock_timestamp(value: bigint) {
    this.set_unlock_timestamp(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_timelock_entry.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_timelock_entry, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for timelock_entry');
    }
    return __tnBigIntToNumber(irResult, 'timelock_entry::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 24) return { ok: false, code: "tn.buffer_too_small", consumed: 24 };
    return { ok: true, consumed: 24 };
  }

  static new(action_id: number, target_id: number, param_val: bigint, unlock_timestamp: bigint): timelock_entry {
    const buffer = new Uint8Array(24);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(0, action_id, true); /* action_id (little-endian) */
    view.setUint32(4, target_id, true); /* target_id (little-endian) */
    view.setBigUint64(8, param_val, true); /* param_val (little-endian) */
    view.setBigUint64(16, unlock_timestamp, true); /* unlock_timestamp (little-endian) */

    return new timelock_entry(buffer);
  }

  static from_array(buffer: Uint8Array): timelock_entry | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new timelock_entry(buffer);
  }

}

export class timelock_entryBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(24);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_action_id(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_target_id(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_param_val(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(8, cast, true);
    return this;
  }

  set_unlock_timestamp(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(16, cast, true);
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

  finish(): timelock_entry {
    const view = timelock_entry.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build timelock_entry");
    return view;
  }
}

__tnRegisterFootprint("timelock_entry", (params) => timelock_entry.__tnInvokeFootprint(params));
__tnRegisterValidate("timelock_entry", (buffer, params) => timelock_entry.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("timelock_entry", (buffer) => { const result = timelock_entry.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR init_registry_args ----- */

const __tn_ir_init_registry_args = {
  typeName: "init_registry_args",
  root: { op: "const", value: 176n }
} as const;

export class init_registry_args {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): init_registry_args {
    if (!buffer || buffer.length === undefined) throw new Error("init_registry_args.__tnCreateView requires a Uint8Array");
    return new init_registry_args(new Uint8Array(buffer));
  }

  static builder(): init_registry_argsBuilder {
    return new init_registry_argsBuilder();
  }

  static fromBuilder(builder: init_registry_argsBuilder): init_registry_args | null {
    const buffer = builder.build();
    return init_registry_args.from_array(buffer);
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

  get_admin_m(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_admin_m(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get admin_m(): number {
    return this.get_admin_m();
  }

  set admin_m(value: number) {
    this.set_admin_m(value);
  }

  get_admin_n(): number {
    const offset = 8;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_admin_n(value: number): void {
    const offset = 8;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get admin_n(): number {
    return this.get_admin_n();
  }

  set admin_n(value: number) {
    this.set_admin_n(value);
  }

  get_min_publishers(): number {
    const offset = 12;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_min_publishers(value: number): void {
    const offset = 12;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get min_publishers(): number {
    return this.get_min_publishers();
  }

  set min_publishers(value: number) {
    this.set_min_publishers(value);
  }

  get_admin_keys(): pubkey_bytes[] {
    const offset = 16;
    const result: pubkey_bytes[] = [];
    for (let i = 0; i < 5; i++) {
      const slice = this.buffer.subarray((offset + i * 32), (offset + (i + 1) * 32));
      result.push(pubkey_bytes.from_array(slice)!);
    }
    return result;
  }

  set_admin_keys(value: pubkey_bytes[]): void {
    const offset = 16;
    if (value.length !== 5) {
      throw new Error('Array length must be 5');
    }
    for (let i = 0; i < 5; i++) {
      const slice = this.buffer.subarray(offset + i * 32, offset + (i + 1) * 32);
      slice.set(value[i]['buffer']);
    }
  }

  get admin_keys(): pubkey_bytes[] {
    return this.get_admin_keys();
  }

  set admin_keys(value: pubkey_bytes[]) {
    this.set_admin_keys(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_init_registry_args.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_init_registry_args, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for init_registry_args');
    }
    return __tnBigIntToNumber(irResult, 'init_registry_args::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 176) return { ok: false, code: "tn.buffer_too_small", consumed: 176 };
    return { ok: true, consumed: 176 };
  }

  static from_array(buffer: Uint8Array): init_registry_args | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new init_registry_args(buffer);
  }

}

export class init_registry_argsBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(176);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_instruction_type(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_admin_m(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_admin_n(value: number): this {
    this.view.setUint32(8, value, true);
    return this;
  }

  set_min_publishers(value: number): this {
    this.view.setUint32(12, value, true);
    return this;
  }

  set_admin_keys(values: pubkey_bytes[]): this {
    if (values.length !== 5) throw new Error("admin_keys expects 5 elements");
    for (let i = 0; i < values.length; i++) {
      const slice = this.buffer.subarray(16 + i * 32, 16 + (i + 1) * 32);
      const source = values[i] as unknown as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number };
      const raw = source.buffer ? new Uint8Array(source.buffer, source.byteOffset ?? 0, 32) : (values[i] as unknown as Uint8Array);
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

  finish(): init_registry_args {
    const view = init_registry_args.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build init_registry_args");
    return view;
  }
}

__tnRegisterFootprint("init_registry_args", (params) => init_registry_args.__tnInvokeFootprint(params));
__tnRegisterValidate("init_registry_args", (buffer, params) => init_registry_args.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("init_registry_args", (buffer) => { const result = init_registry_args.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });

/* ----- TYPE DEFINITION FOR registry_account_data ----- */

const __tn_ir_registry_account_data = {
  typeName: "registry_account_data",
  root: { op: "const", value: 1664n }
} as const;

export class registry_account_data {
  private view: DataView;

  private constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static __tnCreateView(buffer: Uint8Array, opts?: { fieldContext?: Record<string, number | bigint> }): registry_account_data {
    if (!buffer || buffer.length === undefined) throw new Error("registry_account_data.__tnCreateView requires a Uint8Array");
    return new registry_account_data(new Uint8Array(buffer));
  }

  static builder(): registry_account_dataBuilder {
    return new registry_account_dataBuilder();
  }

  static fromBuilder(builder: registry_account_dataBuilder): registry_account_data | null {
    const buffer = builder.build();
    return registry_account_data.from_array(buffer);
  }

  get_magic(): number {
    const offset = 0;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_magic(value: number): void {
    const offset = 0;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get magic(): number {
    return this.get_magic();
  }

  set magic(value: number) {
    this.set_magic(value);
  }

  get_version(): number {
    const offset = 4;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_version(value: number): void {
    const offset = 4;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get version(): number {
    return this.get_version();
  }

  set version(value: number) {
    this.set_version(value);
  }

  get_admin_m(): number {
    const offset = 8;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_admin_m(value: number): void {
    const offset = 8;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get admin_m(): number {
    return this.get_admin_m();
  }

  set admin_m(value: number) {
    this.set_admin_m(value);
  }

  get_admin_n(): number {
    const offset = 12;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_admin_n(value: number): void {
    const offset = 12;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get admin_n(): number {
    return this.get_admin_n();
  }

  set admin_n(value: number) {
    this.set_admin_n(value);
  }

  get_admin_keys(): pubkey_bytes[] {
    const offset = 16;
    const result: pubkey_bytes[] = [];
    for (let i = 0; i < 5; i++) {
      const slice = this.buffer.subarray((offset + i * 32), (offset + (i + 1) * 32));
      result.push(pubkey_bytes.from_array(slice)!);
    }
    return result;
  }

  set_admin_keys(value: pubkey_bytes[]): void {
    const offset = 16;
    if (value.length !== 5) {
      throw new Error('Array length must be 5');
    }
    for (let i = 0; i < 5; i++) {
      const slice = this.buffer.subarray(offset + i * 32, offset + (i + 1) * 32);
      slice.set(value[i]['buffer']);
    }
  }

  get admin_keys(): pubkey_bytes[] {
    return this.get_admin_keys();
  }

  set admin_keys(value: pubkey_bytes[]) {
    this.set_admin_keys(value);
  }

  get_pending_admin_keys(): pubkey_bytes[] {
    const offset = 176;
    const result: pubkey_bytes[] = [];
    for (let i = 0; i < 5; i++) {
      const slice = this.buffer.subarray((offset + i * 32), (offset + (i + 1) * 32));
      result.push(pubkey_bytes.from_array(slice)!);
    }
    return result;
  }

  set_pending_admin_keys(value: pubkey_bytes[]): void {
    const offset = 176;
    if (value.length !== 5) {
      throw new Error('Array length must be 5');
    }
    for (let i = 0; i < 5; i++) {
      const slice = this.buffer.subarray(offset + i * 32, offset + (i + 1) * 32);
      slice.set(value[i]['buffer']);
    }
  }

  get pending_admin_keys(): pubkey_bytes[] {
    return this.get_pending_admin_keys();
  }

  set pending_admin_keys(value: pubkey_bytes[]) {
    this.set_pending_admin_keys(value);
  }

  get_pending_admin_m(): number {
    const offset = 336;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_pending_admin_m(value: number): void {
    const offset = 336;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get pending_admin_m(): number {
    return this.get_pending_admin_m();
  }

  set pending_admin_m(value: number) {
    this.set_pending_admin_m(value);
  }

  get_pending_admin_n(): number {
    const offset = 340;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_pending_admin_n(value: number): void {
    const offset = 340;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get pending_admin_n(): number {
    return this.get_pending_admin_n();
  }

  set pending_admin_n(value: number) {
    this.set_pending_admin_n(value);
  }

  get_admin_transfer_expiry(): bigint {
    const offset = 344;
    return this.view.getBigUint64(offset, true); /* little-endian */
  }

  set_admin_transfer_expiry(value: bigint): void {
    const offset = 344;
    this.view.setBigUint64(offset, value, true); /* little-endian */
  }

  get admin_transfer_expiry(): bigint {
    return this.get_admin_transfer_expiry();
  }

  set admin_transfer_expiry(value: bigint) {
    this.set_admin_transfer_expiry(value);
  }

  get_min_publishers(): number {
    const offset = 352;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_min_publishers(value: number): void {
    const offset = 352;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get min_publishers(): number {
    return this.get_min_publishers();
  }

  set min_publishers(value: number) {
    this.set_min_publishers(value);
  }

  get_publisher_count(): number {
    const offset = 356;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_publisher_count(value: number): void {
    const offset = 356;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get publisher_count(): number {
    return this.get_publisher_count();
  }

  set publisher_count(value: number) {
    this.set_publisher_count(value);
  }

  get_publishers(): publisher_desc[] {
    const offset = 360;
    const result: publisher_desc[] = [];
    for (let i = 0; i < 7; i++) {
      const slice = this.buffer.subarray((offset + i * 48), (offset + (i + 1) * 48));
      result.push(publisher_desc.from_array(slice)!);
    }
    return result;
  }

  set_publishers(value: publisher_desc[]): void {
    const offset = 360;
    if (value.length !== 7) {
      throw new Error('Array length must be 7');
    }
    for (let i = 0; i < 7; i++) {
      const slice = this.buffer.subarray(offset + i * 48, offset + (i + 1) * 48);
      slice.set(value[i]['buffer']);
    }
  }

  get publishers(): publisher_desc[] {
    return this.get_publishers();
  }

  set publishers(value: publisher_desc[]) {
    this.set_publishers(value);
  }

  get_feed_count(): number {
    const offset = 696;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_feed_count(value: number): void {
    const offset = 696;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get feed_count(): number {
    return this.get_feed_count();
  }

  set feed_count(value: number) {
    this.set_feed_count(value);
  }

  get_feeds(): feed_config[] {
    const offset = 700;
    const result: feed_config[] = [];
    for (let i = 0; i < 32; i++) {
      const slice = this.buffer.subarray((offset + i * 24), (offset + (i + 1) * 24));
      result.push(feed_config.from_array(slice)!);
    }
    return result;
  }

  set_feeds(value: feed_config[]): void {
    const offset = 700;
    if (value.length !== 32) {
      throw new Error('Array length must be 32');
    }
    for (let i = 0; i < 32; i++) {
      const slice = this.buffer.subarray(offset + i * 24, offset + (i + 1) * 24);
      slice.set(value[i]['buffer']);
    }
  }

  get feeds(): feed_config[] {
    return this.get_feeds();
  }

  set feeds(value: feed_config[]) {
    this.set_feeds(value);
  }

  get_timelock_count(): number {
    const offset = 1468;
    return this.view.getUint32(offset, true); /* little-endian */
  }

  set_timelock_count(value: number): void {
    const offset = 1468;
    this.view.setUint32(offset, value, true); /* little-endian */
  }

  get timelock_count(): number {
    return this.get_timelock_count();
  }

  set timelock_count(value: number) {
    this.set_timelock_count(value);
  }

  get_timelock_queue(): timelock_entry[] {
    const offset = 1472;
    const result: timelock_entry[] = [];
    for (let i = 0; i < 8; i++) {
      const slice = this.buffer.subarray((offset + i * 24), (offset + (i + 1) * 24));
      result.push(timelock_entry.from_array(slice)!);
    }
    return result;
  }

  set_timelock_queue(value: timelock_entry[]): void {
    const offset = 1472;
    if (value.length !== 8) {
      throw new Error('Array length must be 8');
    }
    for (let i = 0; i < 8; i++) {
      const slice = this.buffer.subarray(offset + i * 24, offset + (i + 1) * 24);
      slice.set(value[i]['buffer']);
    }
  }

  get timelock_queue(): timelock_entry[] {
    return this.get_timelock_queue();
  }

  set timelock_queue(value: timelock_entry[]) {
    this.set_timelock_queue(value);
  }

  private static __tnFootprintInternal(__tnParams: Record<string, bigint>): bigint {
    return __tnEvalFootprint(__tn_ir_registry_account_data.root, { params: __tnParams });
  }

  private static __tnValidateInternal(buffer: Uint8Array, __tnParams: Record<string, bigint>): { ok: boolean; code?: string; consumed?: bigint } {
    return __tnValidateIrTree(__tn_ir_registry_account_data, buffer, __tnParams);
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
      throw new Error('footprint exceeds Number.MAX_SAFE_INTEGER for registry_account_data');
    }
    return __tnBigIntToNumber(irResult, 'registry_account_data::footprint');
  }

  static validate(buffer: Uint8Array, _opts?: { params?: never }): { ok: boolean; code?: string; consumed?: number } {
    if (buffer.length < 1664) return { ok: false, code: "tn.buffer_too_small", consumed: 1664 };
    return { ok: true, consumed: 1664 };
  }

  static from_array(buffer: Uint8Array): registry_account_data | null {
    if (!buffer || buffer.length === undefined) {
      return null;
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const validation = this.validate(buffer);
    if (!validation.ok) {
      return null;
    }
    return new registry_account_data(buffer);
  }

}

export class registry_account_dataBuilder {
  private buffer: Uint8Array;
  private view: DataView;

  constructor() {
    this.buffer = new Uint8Array(1664);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  set_magic(value: number): this {
    this.view.setUint32(0, value, true);
    return this;
  }

  set_version(value: number): this {
    this.view.setUint32(4, value, true);
    return this;
  }

  set_admin_m(value: number): this {
    this.view.setUint32(8, value, true);
    return this;
  }

  set_admin_n(value: number): this {
    this.view.setUint32(12, value, true);
    return this;
  }

  set_admin_keys(values: pubkey_bytes[]): this {
    if (values.length !== 5) throw new Error("admin_keys expects 5 elements");
    for (let i = 0; i < values.length; i++) {
      const slice = this.buffer.subarray(16 + i * 32, 16 + (i + 1) * 32);
      const source = values[i] as unknown as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number };
      const raw = source.buffer ? new Uint8Array(source.buffer, source.byteOffset ?? 0, 32) : (values[i] as unknown as Uint8Array);
      slice.set(raw);
    }
    return this;
  }

  set_pending_admin_keys(values: pubkey_bytes[]): this {
    if (values.length !== 5) throw new Error("pending_admin_keys expects 5 elements");
    for (let i = 0; i < values.length; i++) {
      const slice = this.buffer.subarray(176 + i * 32, 176 + (i + 1) * 32);
      const source = values[i] as unknown as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number };
      const raw = source.buffer ? new Uint8Array(source.buffer, source.byteOffset ?? 0, 32) : (values[i] as unknown as Uint8Array);
      slice.set(raw);
    }
    return this;
  }

  set_pending_admin_m(value: number): this {
    this.view.setUint32(336, value, true);
    return this;
  }

  set_pending_admin_n(value: number): this {
    this.view.setUint32(340, value, true);
    return this;
  }

  set_admin_transfer_expiry(value: bigint): this {
    const cast = __tnToBigInt(value);
    this.view.setBigUint64(344, cast, true);
    return this;
  }

  set_min_publishers(value: number): this {
    this.view.setUint32(352, value, true);
    return this;
  }

  set_publisher_count(value: number): this {
    this.view.setUint32(356, value, true);
    return this;
  }

  set_publishers(values: publisher_desc[]): this {
    if (values.length !== 7) throw new Error("publishers expects 7 elements");
    for (let i = 0; i < values.length; i++) {
      const slice = this.buffer.subarray(360 + i * 48, 360 + (i + 1) * 48);
      const source = values[i] as unknown as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number };
      const raw = source.buffer ? new Uint8Array(source.buffer, source.byteOffset ?? 0, 48) : (values[i] as unknown as Uint8Array);
      slice.set(raw);
    }
    return this;
  }

  set_feed_count(value: number): this {
    this.view.setUint32(696, value, true);
    return this;
  }

  set_feeds(values: feed_config[]): this {
    if (values.length !== 32) throw new Error("feeds expects 32 elements");
    for (let i = 0; i < values.length; i++) {
      const slice = this.buffer.subarray(700 + i * 24, 700 + (i + 1) * 24);
      const source = values[i] as unknown as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number };
      const raw = source.buffer ? new Uint8Array(source.buffer, source.byteOffset ?? 0, 24) : (values[i] as unknown as Uint8Array);
      slice.set(raw);
    }
    return this;
  }

  set_timelock_count(value: number): this {
    this.view.setUint32(1468, value, true);
    return this;
  }

  set_timelock_queue(values: timelock_entry[]): this {
    if (values.length !== 8) throw new Error("timelock_queue expects 8 elements");
    for (let i = 0; i < values.length; i++) {
      const slice = this.buffer.subarray(1472 + i * 24, 1472 + (i + 1) * 24);
      const source = values[i] as unknown as { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number };
      const raw = source.buffer ? new Uint8Array(source.buffer, source.byteOffset ?? 0, 24) : (values[i] as unknown as Uint8Array);
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

  finish(): registry_account_data {
    const view = registry_account_data.from_array(this.buffer.slice());
    if (!view) throw new Error("failed to build registry_account_data");
    return view;
  }
}

__tnRegisterFootprint("registry_account_data", (params) => registry_account_data.__tnInvokeFootprint(params));
__tnRegisterValidate("registry_account_data", (buffer, params) => registry_account_data.__tnInvokeValidate(buffer, params));
__tnRegisterDynamicValidate("registry_account_data", (buffer) => { const result = registry_account_data.validate(buffer); const params = (result as { params?: Record<string, bigint> }).params; return { ok: result.ok, code: result.code, consumed: result.consumed === undefined ? undefined : __tnToBigInt(result.consumed), params }; });
