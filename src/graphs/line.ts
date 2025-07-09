import type { GraphOptions } from './types.ts';

/**
 * Create a smooth line graph using Unicode box drawing characters
 */
export function createLineGraph(data: number[], options: GraphOptions): string {
	const { width, height, padding = '', format = v => `$${v.toFixed(0)}` } = options;
	const yAxisStep = 20; // Y軸の刻み幅

	if (data.length === 0) {
		return '';
	}

	// Handle single data point case
	if (data.length === 1) {
		const value = data[0];
		if (value == null) {
			return '';
		}
		return `${padding}${format(value)} ┼${'─'.repeat(width - 1)}●`;
	}

	// Find min and max values
	const yMin = 0; // Always start from $0
	const dataMax = Math.max(...data);
	// Round up to nearest $20 increment
	const yAxisMax = Math.ceil(dataMax / yAxisStep) * yAxisStep;
	// Ensure minimum height if dataMax is 0
	const yMax = yAxisMax === 0 ? yAxisStep : yAxisMax;
	const yRange = yMax - yMin;

	// Create the graph canvas
	const canvas: string[][] = Array.from({ length: height + 1 }, () => Array.from({ length: width }, () => ' '));

	// Calculate positions for each data point
	const xStep = (width - 1) / (data.length - 1);

	// First, draw connecting lines between points
	for (let i = 0; i < data.length - 1; i++) {
		const x1 = Math.round(i * xStep);
		const x2 = Math.round((i + 1) * xStep);
		const value1 = data[i];
		const value2 = data[i + 1];
		if (value1 == null || value2 == null) {
			continue;
		}
		const normalizedValue1 = (value1 - yMin) / yRange;
		const normalizedValue2 = (value2 - yMin) / yRange;
		const y1 = Math.round(height - normalizedValue1 * height);
		const y2 = Math.round(height - normalizedValue2 * height);

		// Draw line between points using Bresenham's algorithm
		const dx = Math.abs(x2 - x1);
		const dy = Math.abs(y2 - y1);
		const sx = x1 < x2 ? 1 : -1;
		const sy = y1 < y2 ? 1 : -1;
		let err = dx - dy;

		let x = x1;
		let y = y1;

		while (true) {
			if (x >= 0 && x < width && y >= 0 && y <= height) {
				// Use different characters based on line direction
				const canvasRow = canvas[y];
				if (canvasRow != null && canvasRow[x] === ' ') {
					canvasRow[x] = '·';
				}
			}

			if (x === x2 && y === y2) {
				break;
			}

			const e2 = 2 * err;
			if (e2 > -dy) {
				err -= dy;
				x += sx;
			}
			if (e2 < dx) {
				err += dx;
				y += sy;
			}
		}
	}

	// Then, plot the actual data points on top
	for (let i = 0; i < data.length; i++) {
		const x = Math.round(i * xStep);
		const value = data[i];
		if (value == null) {
			continue;
		}
		const normalizedValue = (value - yMin) / yRange;
		const y = Math.round(height - normalizedValue * height);

		if (y >= 0 && y <= height && x >= 0 && x < width && canvas[y] != null) {
			// Use a dot/circle character for data points
			canvas[y][x] = '●';
		}
	}

	// Build output with Y-axis labels
	// Calculate labels for $20 increments
	const yLabels = new Map<number, string>(); // Map<y座標, ラベル文字列>
	for (let value = yMin; value <= yMax; value += yAxisStep) {
		// Calculate y coordinate for this value
		const y = Math.round(height - ((value - yMin) / yRange) * height);
		if (y >= 0 && y <= height) {
			yLabels.set(y, format(value));
		}
	}

	// Find the maximum label width
	const allLabelValues = Array.from(yLabels.values());
	const maxLabelWidth = allLabelValues.length > 0
		? Math.max(...allLabelValues.map(l => l.length))
		: 0;

	// Build each line
	const lines: string[] = [];
	for (let y = 0; y <= height; y++) {
		// Get label for this y coordinate, or empty string if none
		const labelValue = yLabels.get(y);
		const label = (labelValue ?? '').padStart(maxLabelWidth);

		// Use different axis character for labeled vs unlabeled rows
		const axisChar = yLabels.has(y) ? '┼' : '┤';
		// Always use '┼' for bottom line
		const finalAxisChar = y === height ? '┼' : axisChar;

		const canvasRow = canvas[y];
		const line = `${padding}${label} ${finalAxisChar}${canvasRow != null ? canvasRow.join('') : ''}`;
		lines.push(line);
	}

	return lines.join('\n');
}
