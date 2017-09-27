import { BuildArgs } from '../../main';
import baseConfig from './base';

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	config.devtool = 'inline-source-map';
	return config;
}

export default webpackConfig;
