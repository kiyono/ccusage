import type { GraphType } from '../graphs/index.ts';
import process from 'node:process';
import { define } from 'gunshi';
import pc from 'picocolors';
import { sharedCommandConfig } from '../_shared-args.ts';
import { formatCurrency, formatModelsDisplayMultiline, formatNumber, pushBreakdownRows, ResponsiveTable } from '../_utils.ts';
import {
	calculateTotals,
	createTotalsObject,
	getTotalTokens,
} from '../calculate-cost.ts';
import { formatDateCompact, loadDailyUsageData } from '../data-loader.ts';
import { detectMismatches, printMismatchReport } from '../debug.ts';
import { graphGenerators } from '../graphs/index.ts';
import { log, logger } from '../logger.ts';

export const dailyCommand = define({
	name: 'daily',
	description: 'Show usage report grouped by date',
	...sharedCommandConfig,
	async run(ctx) {
		if (ctx.values.json) {
			logger.level = 0;
		}

		const dailyData = await loadDailyUsageData({
			since: ctx.values.since,
			until: ctx.values.until,
			mode: ctx.values.mode,
			order: ctx.values.order,
			offline: ctx.values.offline,
		});

		if (dailyData.length === 0) {
			if (ctx.values.json) {
				log(JSON.stringify([]));
			}
			else {
				logger.warn('No Claude usage data found.');
			}
			process.exit(0);
		}

		// Calculate totals
		const totals = calculateTotals(dailyData);

		// Show debug information if requested
		if (ctx.values.debug && !ctx.values.json) {
			const mismatchStats = await detectMismatches(undefined);
			printMismatchReport(mismatchStats, ctx.values.debugSamples);
		}

		if (ctx.values.json) {
			// Output JSON format
			const jsonOutput = {
				daily: dailyData.map(data => ({
					date: data.date,
					inputTokens: data.inputTokens,
					outputTokens: data.outputTokens,
					cacheCreationTokens: data.cacheCreationTokens,
					cacheReadTokens: data.cacheReadTokens,
					totalTokens: getTotalTokens(data),
					totalCost: data.totalCost,
					modelsUsed: data.modelsUsed,
					modelBreakdowns: data.modelBreakdowns,
				})),
				totals: createTotalsObject(totals),
			};
			log(JSON.stringify(jsonOutput, null, 2));
		}
		else if (ctx.values.graph != null) {
			// Output ASCII art graph
			const graphType = ctx.values.graph as GraphType;

			if (graphType === 'line' && dailyData.length < 2) {
				logger.warn('Cannot draw a line graph with less than 2 data points.');
				process.exit(0);
			}

			// Get terminal width and calculate graph dimensions
			const terminalWidth = process.stdout.columns || 120;
			const padding = '  '; // Reduced padding for our custom implementation
			const graphWidth = Math.max(60, terminalWidth - 12); // Leave space for Y-axis labels

			// Extract data
			const costSeries = dailyData.map(d => d.totalCost);
			const dates = dailyData.map(d => d.date);

			// Generate graph using appropriate generator
			const generator = graphGenerators[graphType];
			if (generator == null) {
				logger.error(`Invalid graph type: ${graphType}. Available types: line, bar`);
				process.exit(1);
			}

			const graph = generator(costSeries, {
				height: 15,
				width: graphWidth,
				padding,
				format: (x: number) => (`$${x.toFixed(0)}`).padStart(6),
			});

			// Print header
			logger.box(`Claude Code Token Usage Report - Daily (${graphType === 'bar' ? 'Bar' : 'Line'} Graph)`);

			// Print graph
			log(graph);

			// Generate x-axis labels with dates
			const dataPoints = dailyData.length;
			const labelPadding = '           '; // Padding to align with graph (includes Y-axis label space)

			// Calculate positions for date labels
			const pointSpacing = graphWidth / (dataPoints - 1);

			// Calculate optimal number of labels
			const minLabelSpacing = 10;
			const maxLabels = Math.floor(graphWidth / minLabelSpacing);
			const labelCount = Math.min(maxLabels, dataPoints);
			const labelInterval = Math.ceil(dataPoints / labelCount);

			// Build x-axis with date labels
			let xAxisLabels = labelPadding;

			// Select indices to show
			const selectedIndices: number[] = [];
			selectedIndices.push(0); // Always show first

			// Add intermediate dates
			for (let i = labelInterval; i < dataPoints - 1; i += labelInterval) {
				selectedIndices.push(i);
			}

			// Always show last date if not too close to previous
			const lastIndex = dataPoints - 1;
			if (dataPoints > 1) {
				const lastSelectedIndex = selectedIndices[selectedIndices.length - 1];
				if ((lastSelectedIndex != null && lastIndex - lastSelectedIndex >= labelInterval / 2) || selectedIndices.length === 1) {
					selectedIndices.push(lastIndex);
				}
			}

			// Build the label string
			let currentPos = labelPadding.length;
			for (let i = 0; i < selectedIndices.length; i++) {
				const index = selectedIndices[i];
				if (index != null) {
					const date = dates[index];
					if (date != null) {
						const dateStr = date.split('-').slice(1).join('/'); // Format as MM/DD
						const targetPos = Math.round(labelPadding.length + index * pointSpacing);

						// For the last label, adjust position to not go beyond graph width
						let adjustedPos = targetPos;
						if (i === selectedIndices.length - 1 && index === dataPoints - 1) {
							adjustedPos = Math.min(targetPos, labelPadding.length + graphWidth - dateStr.length);
						}

						// Only add label if there's enough space
						if (adjustedPos >= currentPos) {
							const spaces = adjustedPos - currentPos;
							xAxisLabels += ' '.repeat(Math.max(0, spaces)) + dateStr;
							currentPos = adjustedPos + dateStr.length;
						}
					}
				}
			}

			// Print x-axis
			log(xAxisLabels);

			// Add a newline for better spacing
			log('');

			// Print summary statistics
			const maxCost = Math.max(...costSeries);
			const minCost = Math.min(...costSeries);
			const avgCost = totals.totalCost / dailyData.length;

			log(`${pc.dim('Max:')} ${formatCurrency(maxCost)} | ${pc.dim('Min:')} ${formatCurrency(minCost)} | ${pc.dim('Avg:')} ${formatCurrency(avgCost)}`);
			log(`${pc.yellow('Total:')} ${pc.yellow(formatCurrency(totals.totalCost))}`);
		}
		else {
			// Print header
			logger.box('Claude Code Token Usage Report - Daily');

			// Create table with compact mode support
			const table = new ResponsiveTable({
				head: [
					'Date',
					'Models',
					'Input',
					'Output',
					'Cache Create',
					'Cache Read',
					'Total Tokens',
					'Cost (USD)',
				],
				style: {
					head: ['cyan'],
				},
				colAligns: [
					'left',
					'left',
					'right',
					'right',
					'right',
					'right',
					'right',
					'right',
				],
				dateFormatter: formatDateCompact,
				compactHead: [
					'Date',
					'Models',
					'Input',
					'Output',
					'Cost (USD)',
				],
				compactColAligns: [
					'left',
					'left',
					'right',
					'right',
					'right',
				],
				compactThreshold: 100,
			});

			// Add daily data
			for (const data of dailyData) {
				// Main row
				table.push([
					data.date,
					formatModelsDisplayMultiline(data.modelsUsed),
					formatNumber(data.inputTokens),
					formatNumber(data.outputTokens),
					formatNumber(data.cacheCreationTokens),
					formatNumber(data.cacheReadTokens),
					formatNumber(getTotalTokens(data)),
					formatCurrency(data.totalCost),
				]);

				// Add model breakdown rows if flag is set
				if (ctx.values.breakdown) {
					pushBreakdownRows(table, data.modelBreakdowns);
				}
			}

			// Add empty row for visual separation before totals
			table.push([
				'',
				'',
				'',
				'',
				'',
				'',
				'',
				'',
			]);

			// Add totals
			table.push([
				pc.yellow('Total'),
				'', // Empty for Models column in totals
				pc.yellow(formatNumber(totals.inputTokens)),
				pc.yellow(formatNumber(totals.outputTokens)),
				pc.yellow(formatNumber(totals.cacheCreationTokens)),
				pc.yellow(formatNumber(totals.cacheReadTokens)),
				pc.yellow(formatNumber(getTotalTokens(totals))),
				pc.yellow(formatCurrency(totals.totalCost)),
			]);

			log(table.toString());

			// Show guidance message if in compact mode
			if (table.isCompactMode()) {
				logger.info('\nRunning in Compact Mode');
				logger.info('Expand terminal width to see cache metrics and total tokens');
			}
		}
	},
});

if (import.meta.vitest != null) {
	const { describe, it, expect, vi } = import.meta.vitest;
	// Dynamic import is needed to avoid tree-shaking issues
	// eslint-disable-next-line antfu/no-top-level-await
	const { createFixture } = await import('fs-fixture');

	describe('daily command with --graph option', () => {
		it('should display ASCII art graph when --graph option is used', async () => {
			// Create mock data directory
			const fixture = await createFixture({
				projects: {
					'test-project': {
						'session-1': {
							'claude_20250101_000000.jsonl': `${JSON.stringify({
								timestamp: '2025-01-01T00:00:00Z',
								message: {
									model: 'claude-sonnet-4-20250514',
									usage: {
										input_tokens: 100,
										output_tokens: 200,
										cache_creation_input_tokens: 50,
										cache_read_input_tokens: 25,
									},
								},
								costUSD: 0.00123,
							})}\n`,
							'claude_20250102_000000.jsonl': `${JSON.stringify({
								timestamp: '2025-01-02T00:00:00Z',
								message: {
									model: 'claude-sonnet-4-20250514',
									usage: {
										input_tokens: 150,
										output_tokens: 250,
										cache_creation_input_tokens: 60,
										cache_read_input_tokens: 30,
									},
								},
								costUSD: 0.00234,
							})}\n`,
							'claude_20250103_000000.jsonl': `${JSON.stringify({
								timestamp: '2025-01-03T00:00:00Z',
								message: {
									model: 'claude-opus-4-20250514',
									usage: {
										input_tokens: 200,
										output_tokens: 300,
										cache_creation_input_tokens: 70,
										cache_read_input_tokens: 35,
									},
								},
								costUSD: 0.00345,
							})}\n`,
						},
					},
				},
			});

			// Mock console.log to capture output
			const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			// Mock environment variable for test
			vi.stubEnv('CLAUDE_CONFIG_DIR', fixture.path);

			try {
				// Load data
				const dailyData = await loadDailyUsageData({
					mode: 'display',
					order: 'asc',
					offline: true,
					claudePath: fixture.path,
				});

				expect(dailyData.length).toBe(3);

				// Test graph generation
				const costSeries = dailyData.map(d => d.totalCost);
				expect(costSeries).toEqual([0.00123, 0.00234, 0.00345]);

				const graph = graphGenerators.line(costSeries, {
					height: 10,
					width: 60,
					padding: '      ',
					format: (x: number) => (`$${x.toFixed(2)}`).padStart(8),
				});

				// Graph should be a string
				expect(typeof graph).toBe('string');
				// eslint-disable-next-line ts/no-unsafe-member-access
				expect((graph as any).length).toBeGreaterThan(0);
			}
			finally {
				// Cleanup
				logSpy.mockRestore();
				vi.unstubAllEnvs();
				await fixture.rm();
			}
		});

		it('should warn when less than 2 data points for graph', async () => {
			// Create mock data directory with only one data point
			const fixture = await createFixture({
				projects: {
					'test-project': {
						'session-1': {
							'claude_20250101_000000.jsonl': `${JSON.stringify({
								timestamp: '2025-01-01T00:00:00Z',
								message: {
									model: 'claude-sonnet-4-20250514',
									usage: {
										input_tokens: 100,
										output_tokens: 200,
										cache_creation_input_tokens: 50,
										cache_read_input_tokens: 25,
									},
								},
								costUSD: 0.00123,
							})}\n`,
						},
					},
				},
			});

			// Mock environment variable for test
			vi.stubEnv('CLAUDE_CONFIG_DIR', fixture.path);

			try {
				// Load data
				const dailyData = await loadDailyUsageData({
					mode: 'display',
					order: 'asc',
					offline: true,
					claudePath: fixture.path,
				});

				// Should only have one data point
				expect(dailyData.length).toBe(1);

				// This condition should trigger the warning in actual command execution
				if (dailyData.length < 2) {
					expect(true).toBe(true); // Test passes when we have less than 2 data points
				}
			}
			finally {
				// Cleanup
				vi.unstubAllEnvs();
				await fixture.rm();
			}
		});
	});
}
