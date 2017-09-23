import { BuildArgs } from '../../main';
import baseConfig from './base';

const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	config.devtool = 'inline-source-map';

	const entry = config.entry['src/main'];

	config.entry['src/main'] = [ ...entry, 'webpack-dev-server/client?' ];
	config.devServer = {
		compress: true,
		port: 9000
	};

	const plugins = [ ...config.plugins ];
	plugins.push(
		new CopyWebpackPlugin([ { context: 'src', from: '**/*', ignore: '*.ts' } ]),
		new HtmlWebpackPlugin({ inject: true, chunks: [ 'src/main' ], template: 'src/index.html' })
	);

	config.plugins = plugins;

	return config;
}

export default webpackConfig;
