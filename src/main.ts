import { Command, EjectOutput, Helper, OptionsHelper } from '@dojo/interfaces/cli';
import { underline } from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import webpack = require('webpack');
import config from './webpack.config';

const pkgDir = require('pkg-dir');

export interface Bundles {
	[key: string]: string[];
}

export interface BuildArgs {
	[index: string]: any;
	bundles: Bundles;
	force: boolean;
}

interface ConfigFactory {
	(args: Partial<BuildArgs>): webpack.Config;
}

interface WebpackOptions {
	compress: boolean;
	stats: {
		colors: boolean
		chunks: boolean
	};
}

function mergeConfigArgs(...sources: BuildArgs[]): BuildArgs {
	return sources.reduce((args: BuildArgs, source: BuildArgs) => {
		Object.keys(source).forEach((key: string) => {
			const value = source[key];
			if (typeof value !== 'undefined') {
				args[key] = source[key];
			}
		});
		return args;
	}, Object.create(null));
}

function compile(config: webpack.Config, options: WebpackOptions, args: BuildArgs): Promise<void> {
	const compiler = webpack(config);
	return new Promise<void>((resolve, reject) => {
		compiler.run((err, stats) => {
			if (err) {
				reject(err);
				return;
			}

			if (stats) {
				if (config.profile) {
					fs.writeFileSync('dist/profile.json', JSON.stringify(stats.toJson()));
				}

				console.log(stats.toString(options.stats));

				if (stats.compilation && stats.compilation.errors && stats.compilation.errors.length > 0 && !args.force) {
					reject({
						exitCode: 1,
						message: 'The build failed with errors. Use the --force to overcome this obstacle.'
					});
					return;
				}
			}
			resolve();
		});
	});
}

function buildNpmDependencies(): any {
	try {
		const packagePath = pkgDir.sync(__dirname);
		const packageJsonFilePath = path.join(packagePath, 'package.json');
		const packageJson = <any> require(packageJsonFilePath);

		return {
			[packageJson.name]: packageJson.version,
			...packageJson.dependencies
		};
	}
	catch (e) {
		throw new Error('Failed reading dependencies from package.json - ' + e.message);
	}
}

const command: Command<BuildArgs> = {
	group: 'build',
	name: 'webpack',
	description: 'create a build of your application',
	register(options: OptionsHelper): void {
		options('force', {
			describe: 'Ignore build errors and use a successful return code',
			default: false,
			type: 'boolean'
		});
	},
	run(helper: Helper, args: BuildArgs): Promise<void> {
		const dojoRc = helper.configuration.get() || Object.create(null);
		const options: WebpackOptions = {
			compress: true,
			stats: {
				colors: true,
				chunks: false
			}
		};
		const configArgs = mergeConfigArgs(dojoRc as BuildArgs, args);
		return compile(config(configArgs), options, args) as Promise<void>;
	},
	eject(helper: Helper) {
		const ejectOutput: EjectOutput = {
			npm: {
				devDependencies: {
					...buildNpmDependencies()
				}
			},
			copy: {
				path: __dirname,
				files: [
					'./webpack.config.js'
				]
			},
			hints: [
				'to build run ' + underline('./node_modules/.bin/webpack --config ./config/build-webpack/webpack.config.js')
			]
		};

		return ejectOutput;
	}
};
export default command;
