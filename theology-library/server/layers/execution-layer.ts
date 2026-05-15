import {
  interpolateRuntimeValue,
  RuntimeValue,
  validateResolvedNetworkParameterShapes
} from './node-executor';

export type ExecutionNode = {
  id: string;
  component: string;
  params: Record<string, RuntimeValue>;
  expectedParams: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
};

export function buildExecutionNode(
  node: ExecutionNode,
  runtimeState: Record<string, RuntimeValue>
): ExecutionNode {
  const resolvedParams = interpolateRuntimeValue(node.params, runtimeState) as Record<string, RuntimeValue>;

  for (const [key, shape] of Object.entries(node.expectedParams)) {
    validateResolvedNetworkParameterShapes(resolvedParams[key], shape);
  }

  return {
    ...node,
    params: resolvedParams
  };
}
