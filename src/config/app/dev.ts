import { BuildArgs } from '../../main';
import baseConfig from './base';

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	config.devtool = 'inline-source-map';
	const entry = config.entry;
	//entry['tests/unit'] = [ 'multi-entry-loader?include=tests/unit/**/*.ts' ];
	console.log(entry);
	return config;
}

export default webpackConfig;
