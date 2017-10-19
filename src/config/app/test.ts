import { BuildArgs } from '../../main';
import baseConfig from './base';
import * as path from 'path';
const globby = require('globby');

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	config.entry = () => {
		const unit = globby
			.sync([`${args.basePath}/tests/unit/**/*.ts`])
			.map((filename: string) => filename.replace(/\.ts$/, ''));

		const functional = globby
			.sync([`${args.basePath}/tests/functional/**/*.ts`])
			.map((filename: string) => filename.replace(/\.ts$/, ''));

		return { unit, functional };
	};
	config.externals = config.externals || [];
	config.externals.push(/^intern/);
	config.devtool = 'inline-source-map';
	config.output.path = path.join(config.output.path, 'test');
	return config;
}

export default webpackConfig;
