/**
 * Custom ASCII graph implementation for better line graph rendering
 */

export type GraphOptions = {
	width: number;
	height: number;
	padding?: string;
	format?: (value: number) => string;
};

/**
 * Draw an ASCII line graph with proper interpolation
 */
export function drawLineGraph(data: number[], options: GraphOptions): string {
	const { width, height, padding = '', format = v => v.toFixed(2) } = options;

	if (data.length === 0) {
		return '';
	}
	if (data.length === 1) {
		return `${padding}${format(data[0])} ┼${'─'.repeat(width)}`;
	}

	// Find min and max values
	const min = Math.min(...data);
	const max = Math.max(...data);
	const range = max - min || 1;

	// Create a 2D grid for the graph
	const grid: string[][] = Array.from({ length: height + 1 }, () => Array.from({ length: width }, () => ' '));

	// Calculate Y-axis labels and positions
	const yLabels: Array<{ value: number; row: number }> = [];
	for (let i = 0; i <= height; i++) {
		const value = max - (i / height) * range;
		yLabels.push({ value, row: i });
	}

	// Plot the data points with interpolation
	const xStep = (width - 1) / (data.length - 1);

	// First pass: plot the actual data points
	const plotPoints: Array<{ x: number; y: number }> = [];
	for (let i = 0; i < data.length; i++) {
		const x = Math.round(i * xStep);
		const normalizedValue = (data[i] - min) / range;
		const y = Math.round(height - normalizedValue * height);
		plotPoints.push({ x, y });
	}

	// Second pass: draw lines between points
	for (let i = 0; i < plotPoints.length - 1; i++) {
		const p1 = plotPoints[i];
		const p2 = plotPoints[i + 1];

		// Draw line from p1 to p2
		drawLine(grid, p1.x, p1.y, p2.x, p2.y);
	}

	// Build the output string
	const lines: string[] = [];

	// Add each row with Y-axis labels
	for (let i = 0; i <= height; i++) {
		const label = yLabels[i];
		const formattedLabel = format(label.value).padStart(padding.length - 2);
		const rowChar = i === height ? '┼' : '┤';
		const row = `${formattedLabel} ${rowChar}${grid[i].join('')}`;
		lines.push(row);
	}

	return lines.join('\n');
}

/**
 * Draw a line between two points using ASCII characters
 */
function drawLine(grid: string[][], x1: number, y1: number, x2: number, y2: number): void {
	// Bresenham's line algorithm
	const dx = Math.abs(x2 - x1);
	const dy = Math.abs(y2 - y1);
	const sx = x1 < x2 ? 1 : -1;
	const sy = y1 < y2 ? 1 : -1;
	let err = dx - dy;

	let x = x1;
	let y = y1;

	while (true) {
		// Determine the character to use based on the line direction
		if (x >= 0 && x < grid[0].length && y >= 0 && y < grid.length) {
			const prevChar = grid[y][x];

			// Determine the character based on the line direction
			let char = '─';
			if (dx === 0) {
				char = '│';
			}
			else if (dy === 0) {
				char = '─';
			}
			else if ((sx === 1 && sy === 1) || (sx === -1 && sy === -1)) {
				char = '╲';
			}
			else {
				char = '╱';
			}

			// Handle intersections
			if (prevChar !== ' ') {
				char = combineChars(prevChar, char);
			}

			grid[y][x] = char;
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

/**
 * Combine two line characters at an intersection
 */
function combineChars(char1: string, char2: string): string {
	// Simple combination logic - can be expanded
	const horizontal = ['─', '╱', '╲'];
	const vertical = ['│', '╱', '╲'];

	if (horizontal.includes(char1) && vertical.includes(char2)) {
		return '┼';
	}
	if (vertical.includes(char1) && horizontal.includes(char2)) {
		return '┼';
	}

	// For simplicity, just return one of them
	return char2;
}

/**
 * Create a smooth line graph using Unicode box drawing characters
 */
export function createSmoothLineGraph(data: number[], options: GraphOptions): string {
	const { width, height, padding = '', format = v => `$${v.toFixed(0)}` } = options;
	const yAxisStep = 20; // Y軸の刻み幅

	if (data.length === 0) {
		return '';
	}

	// Handle single data point case
	if (data.length === 1) {
		const value = data[0];
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
				if (canvas[y][x] === ' ') {
					if (dy === 0) {
						// Horizontal line
						canvas[y][x] = '·';
					}
					else if (dx === 0) {
						// Vertical line
						canvas[y][x] = '·';
					}
					else if ((sx === 1 && sy === 1) || (sx === -1 && sy === -1)) {
						// Diagonal down
						canvas[y][x] = '·';
					}
					else {
						// Diagonal up
						canvas[y][x] = '·';
					}
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
		const normalizedValue = (value - yMin) / yRange;
		const y = Math.round(height - normalizedValue * height);

		if (y >= 0 && y <= height && x >= 0 && x < width) {
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

		const line = `${padding}${label} ${finalAxisChar}${canvas[y].join('')}`;
		lines.push(line);
	}

	return lines.join('\n');
}
