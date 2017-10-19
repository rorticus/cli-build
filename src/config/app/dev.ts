import { BuildArgs } from '../../main';
import baseConfig from './base';
import * as path from 'path';
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	const plugins = [
		...config.plugins,
		new CopyWebpackPlugin([ { context: 'src', from: '**/*', ignore: '*.ts' } ]),
		new HtmlWebpackPlugin({ inject: true, chunks: [ 'src/main' ], template: 'src/index.html' })
	];
	config.plugins = plugins;
	config.devtool = 'inline-source-map';
	config.output.path = path.join(config.output.path, 'dev');
	return config;
}

export default webpackConfig;
