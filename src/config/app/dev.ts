import { BuildArgs } from '../../main';
import baseConfig from './base';
import * as path from 'path';

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	config.devtool = 'inline-source-map';
	config.output.path = path.join(config.output.path, 'dev');
	return config;
}

export default webpackConfig;
