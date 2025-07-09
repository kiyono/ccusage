import type { GraphOptions } from './types.ts';
import { createBarGraph } from './bar.ts';
import { createLineGraph } from './line.ts';

export type GraphType = 'line' | 'bar';
export type GraphGenerator = (data: number[], options: GraphOptions) => string;

export const graphGenerators: Record<GraphType, GraphGenerator> = {
	line: createLineGraph,
	bar: createBarGraph,
};

export { type GraphOptions } from './types.ts';
