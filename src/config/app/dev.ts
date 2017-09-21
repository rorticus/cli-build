import { BuildArgs } from '../../main';
import baseConfig from './base';

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	config.devtool = 'inline-source-map';
	const entry = config.entry['src/main'];
	config.entry['src/main'] = [ ...entry, 'webpack-dev-server/client?' ];
	config.devServer = {
		compress: true,
		port: 9000
	};
	return config;
}

export default webpackConfig;
