import { BuildArgs } from '../../main';
import baseConfig from './base';
import * as path from 'path';
import { existsSync } from 'fs';

function webpackConfig(args: Partial<BuildArgs>) {
	const config: any = baseConfig(args);
	const entry = config.entry;

	const unitPath = path.join(args.basePath, 'tests/unit/all.ts');
	const functionalPath = path.join(args.basePath, 'tests/functional/all.ts');

	delete entry['src/main'];

	if (existsSync(unitPath)) {
		entry['tests/unit/all'] = [ unitPath ];
	}
	if (existsSync(functionalPath)) {
		entry['tests/functional/all'] = [ functionalPath ];
	}

	return config;
}

export default webpackConfig;
