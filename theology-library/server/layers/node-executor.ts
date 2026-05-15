export class ParameterResolutionError extends Error {
  constructor(message: string, public readonly detail?: Record<string, unknown>) {
    super(message);
    this.name = 'ParameterResolutionError';
  }
}

export type RuntimeValue = string | number | boolean | null | RuntimeValue[] | { [k: string]: RuntimeValue };

const REF_PREFIX = 'ref:hive_mind:';

export function resolveReferenceToken(token: string, runtimeState: Record<string, RuntimeValue>): RuntimeValue {
  if (!token.startsWith(REF_PREFIX)) {
    return token;
  }

  const key = token.slice(REF_PREFIX.length);
  const resolved = runtimeState[key];
  if (typeof resolved === 'undefined') {
    throw new ParameterResolutionError(`Unresolved runtime reference: ${token}`, { token, key });
  }

  return resolved;
}

export function interpolateRuntimeValue(input: RuntimeValue, runtimeState: Record<string, RuntimeValue>): RuntimeValue {
  if (typeof input === 'string') return resolveReferenceToken(input, runtimeState);
  if (Array.isArray(input)) return input.map((item) => interpolateRuntimeValue(item, runtimeState));
  if (input && typeof input === 'object') {
    return Object.entries(input).reduce<Record<string, RuntimeValue>>((acc, [k, v]) => {
      acc[k] = interpolateRuntimeValue(v, runtimeState);
      return acc;
    }, {});
  }
  return input;
}

export function validateResolvedNetworkParameterShapes(
  resolvedInput: RuntimeValue,
  expectedShape: 'string' | 'number' | 'boolean' | 'object' | 'array'
): void {
  const isValid =
    (expectedShape === 'array' && Array.isArray(resolvedInput)) ||
    (expectedShape === 'object' && !!resolvedInput && typeof resolvedInput === 'object' && !Array.isArray(resolvedInput)) ||
    (expectedShape === 'string' && typeof resolvedInput === 'string') ||
    (expectedShape === 'number' && typeof resolvedInput === 'number') ||
    (expectedShape === 'boolean' && typeof resolvedInput === 'boolean');

  if (!isValid) {
    throw new ParameterResolutionError('Resolved parameter shape mismatch', {
      expectedShape,
      receivedType: Array.isArray(resolvedInput) ? 'array' : typeof resolvedInput,
      resolvedInput
    });
  }
}
