import type { GraphOptions } from './types.ts';

/**
 * Create a vertical bar graph using Unicode box drawing characters
 */
export function createBarGraph(data: number[], options: GraphOptions): string {
	const { width, height, padding = '', format = v => `$${v.toFixed(0)}` } = options;
	const yAxisStep = 20; // Y軸の刻み幅

	if (data.length === 0) {
		return '';
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

	// Calculate bar width and spacing
	const availableWidth = width - 2; // Leave space at start and end
	const barAreaWidth = Math.floor(availableWidth / data.length);
	const barWidth = Math.max(1, Math.floor(barAreaWidth * 0.8)); // 80% of space for bar
	const spacing = Math.max(1, Math.floor((barAreaWidth - barWidth) / 2));

	// Draw bars
	for (let i = 0; i < data.length; i++) {
		const value = data[i];
		if (value == null) {
			continue;
		}
		const normalizedValue = (value - yMin) / yRange;
		const barHeight = Math.round(normalizedValue * height);

		// Calculate bar position
		const barStart = 1 + i * barAreaWidth + spacing;
		const barEnd = Math.min(barStart + barWidth, width);

		// Draw the bar from bottom up
		for (let y = height; y > height - barHeight; y--) {
			for (let x = barStart; x < barEnd; x++) {
				if (x < width) {
					const canvasRow = canvas[y];
					if (canvasRow != null) {
						canvasRow[x] = '█';
					}
				}
			}
		}

		// Optionally add value on top of bar if there's space
		if (barHeight < height - 1) {
			const valueStr = format(value);
			const valueY = height - barHeight;
			const valueX = barStart + Math.floor((barWidth - valueStr.length) / 2);

			if (valueY >= 0 && valueX >= 0 && valueX + valueStr.length <= width) {
				for (let j = 0; j < valueStr.length; j++) {
					if (valueX + j < width && canvas[valueY] != null && valueStr[j] != null) {
						const char = valueStr[j];
						if (char != null && canvas[valueY] != null) {
							canvas[valueY][valueX + j] = char;
						}
					}
				}
			}
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

if (import.meta.vitest != null) {
	const { describe, it, expect } = import.meta.vitest;

	describe('createBarGraph', () => {
		it('should create a bar graph with correct bars', () => {
			const data = [10, 20, 30, 15, 25];
			const graph = createBarGraph(data, {
				height: 10,
				width: 40,
				padding: '  ',
				format: (x: number) => (`$${x.toFixed(0)}`).padStart(4),
			});

			// Graph should be a string
			expect(typeof graph).toBe('string');
			// Should have correct number of lines (height + 1)
			expect(graph.split('\n').length).toBe(11);
			// Should contain bar characters
			expect(graph).toContain('█');
			// Should contain axis characters
			expect(graph).toContain('┼');
			expect(graph).toContain('┤');
		});

		it('should handle empty data', () => {
			const graph = createBarGraph([], {
				height: 10,
				width: 40,
			});
			expect(graph).toBe('');
		});

		it('should handle single data point', () => {
			const data = [50];
			const graph = createBarGraph(data, {
				height: 10,
				width: 20,
				format: (x: number) => `$${x}`,
			});

			expect(graph).toContain('█');
			expect(graph).toContain('$50');
		});
	});
}
