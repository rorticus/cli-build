import { BuildArgs } from '../../interfaces';
import baseConfig from './base';
import webpack = require('webpack');
import * as path from 'path';

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer-sunburst').BundleAnalyzerPlugin;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);

	const plugins = [
		...config.plugins,
		new BundleAnalyzerPlugin({
			analyzerMode: 'static',
			openAnalyzer: false,
			reportType: 'sunburst',
			generateStatsFile: true,
			reportFilename: '../info/report.html',
			statsFilename: '../info/stats.json'
		}),
		new HtmlWebpackPlugin({ inject: true, chunks: [ 'src/main' ], template: 'src/index.html' }),
		new webpack.optimize.UglifyJsPlugin({ sourceMap: true, compress: { warnings: false }, exclude: /tests[/]/ })
	].map((plugin: any) => {
		if (plugin instanceof ExtractTextPlugin) {
			return new ExtractTextPlugin({
				filename: '[contenthash].bundle.css',
				allChunks: true
			});
		}
		return plugin;
	});

	config.plugins = plugins;
	config.output.path = path.join(config.output.path, 'dist');
	config.output.chunkFilename = '[chunkhash].bundle.js';
	config.output.filename = '[chunkhash].bundle.js';
	return config;
}

export default webpackConfig;
