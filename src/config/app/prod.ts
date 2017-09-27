import { BuildArgs } from '../../main';
import baseConfig from './base';
import webpack = require('webpack');
import * as path from 'path';

const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer-sunburst').BundleAnalyzerPlugin;
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);

	const plugins = [
		...config.plugins,
		new OptimizeCssAssetsPlugin({ cssProcessorOptions: { map: { inline: false } } }),
		new BundleAnalyzerPlugin({
			analyzerMode: 'static',
			openAnalyzer: false,
			reportType: 'sunburst',
			generateStatsFile: true,
			reportFilename: '../info/report.html',
			statsFilename: '../info/stats.json'
		}),
		new CopyWebpackPlugin([ { context: 'src', from: '**/*', ignore: '*.ts' } ]),
		new HtmlWebpackPlugin({ inject: true, chunks: [ 'src/main' ], template: 'src/index.html' }),
		new webpack.optimize.UglifyJsPlugin({ sourceMap: true, compress: { warnings: false }, exclude: /tests[/]/ })
	];

	config.plugins = plugins;
	config.output.path = path.join(config.output.path, 'dist');
	return config;
}

export default webpackConfig;
