import { BuildArgs } from '../../main';
import baseConfig from './base';
import webpack = require('webpack');

const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer-sunburst').BundleAnalyzerPlugin;

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	const plugins = [
		...config.plugins,
		new OptimizeCssAssetsPlugin({ cssProcessorOptions: { map: { inline: false } } }),
		new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false, reportType: 'sunburst' }),
		new webpack.optimize.UglifyJsPlugin({ sourceMap: true, compress: { warnings: false }, exclude: /tests[/]/ })
	];
	config.plugins = plugins;
	return config;
}

export default webpackConfig;
