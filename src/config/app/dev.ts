import { BuildArgs } from '../../main';
import baseConfig from './base';
import * as path from 'path';
const globby = require('globby');

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	const entry = config.entry;
	config.entry = () => {
		const units = globby.sync([`${args.basePath}/tests/unit/**/*.ts`])
			.map((filename: string) => filename.replace(/\.ts$/, ''));

		const functionals = globby.sync([`${args.basePath}/tests/functional/**/*.ts`])
			.map((filename: string) => filename.replace(/\.ts$/, ''));

		const testEntries = {
			'tests/unit': units,
			'tests/functional': functionals
		};
		return { ...entry, ...testEntries };
	};
	config.externals = config.externals || [];
	config.externals.push(/^intern/);
	config.devtool = 'inline-source-map';
	config.output.path = path.join(config.output.path, 'dev');
	return config;
}

export default webpackConfig;
