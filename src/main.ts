import { Command, EjectOutput, Helper, OptionsHelper } from '@dojo/cli/interfaces';
import { Argv } from 'yargs';
import config from './webpack.config';
import * as fs from 'fs';
import webpack = require('webpack');
const WebpackDevServer: any = require('webpack-dev-server');

export interface BuildArgs extends Argv {
	locale: string;
	messageBundles: string | string[];
	supportedLocales: string | string[];
	watch: boolean;
	port: number;
	element: string;
	elementPrefix: string;
	withTests: boolean;
	debug: boolean;
}

interface WebpackOptions {
	compress: boolean;
	stats: {
		colors: boolean
		chunks: boolean
	};
}

function getConfigArgs(args: BuildArgs): Partial<BuildArgs> {
	const { locale, messageBundles, supportedLocales, watch } = args;
	const options: Partial<BuildArgs> = Object.keys(args).reduce((options: Partial<BuildArgs>, key: string) => {
		if (key !== 'messageBundles' && key !== 'supportedLocales') {
			options[key] = args[key];
		}
		return options;
	}, Object.create(null));

	if (messageBundles) {
		options.messageBundles = Array.isArray(messageBundles) ? messageBundles : [ messageBundles ];
	}

	if (supportedLocales) {
		options.supportedLocales = Array.isArray(supportedLocales) ? supportedLocales : [ supportedLocales ];
	}

	if (args.element && !args.elementPrefix) {
		const factoryPattern = /create(.*?)Element.*?\.ts$/;
		const matches = args.element.match(factoryPattern);

		if (matches && matches[ 1 ]) {
			options.elementPrefix = matches[ 1 ].replace(/[A-Z][a-z]/g, '-\$&').replace(/^-+/g, '').toLowerCase();
		} else {
			console.error(`"${args.element}" does not follow the pattern "createXYZElement". Use --elementPrefix to name element.`);
			process.exit();
		}
	}

	return options;
}

function watch(config: webpack.Config, options: WebpackOptions, args: BuildArgs): Promise<any> {
	config.devtool = 'inline-source-map';

	config.entry = (function (entry) {
		if (typeof entry === 'object' && !Array.isArray(entry)) {
			Object.keys(entry).forEach((key) => {
				const value = entry[key];
				if (typeof value === 'string') {
					entry[key] = [ 'webpack-dev-server/client?', value ];
				}
				else {
					value.unshift('webpack-dev-server/client?');
				}
			});
		}
		return entry;
	})(config.entry);

	const compiler = webpack(config);
	const server = new WebpackDevServer(compiler, options);

	return new Promise((resolve, reject) => {
		const port = args.port || 9999;
		server.listen(port, '127.0.0.1', (err: Error) => {
			console.log(`Starting server on http://localhost:${port}`);
			if (err) {
				reject(err);
				return;
			}
		});
	});
}

function compile(config: webpack.Config, options: WebpackOptions): Promise<any> {
	const compiler = webpack(config);
	return new Promise((resolve, reject) => {
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
			}
			resolve({});
		});
	});
}

const command: Command = {
	description: 'create a build of your application',
	register(options: OptionsHelper): void {
		options('w', {
			alias: 'watch',
			describe: 'watch and serve'
		});

		options('p', {
			alias: 'port',
			describe: 'port to serve on when using --watch',
			type: 'number'
		});

		options('t', {
			alias: 'with-tests',
			describe: 'build tests as well as sources'
		});

		options('locale', {
			describe: 'The default locale for the application',
			type: 'string'
		});

		options('supportedLocales', {
			describe: 'Any additional locales supported by the application',
			type: 'array'
		});

		options('messageBundles', {
			describe: 'Any message bundles to include in the build',
			type: 'array'
		});

		options('element', {
			describe: 'Path to a custom element descriptor factory',
			type: 'string'
		});

		options('elementPrefix', {
			describe: 'Output file for custom element',
			type: 'string'
		});

		options('debug', {
			describe: 'Generate package information useful for debugging',
			type: 'boolean'
		});
	},
	run(helper: Helper, args: BuildArgs) {
		const options: WebpackOptions = {
			compress: true,
			stats: {
				colors: true,
				chunks: false
			}
		};
		const configArgs = getConfigArgs(args);

		if (args.watch) {
			return watch(config(configArgs), options, args);
		}
		else {
			return compile(config(configArgs), options);
		}
	},
	eject(helper: Helper) {
		const ejectOutput: EjectOutput = {
			npm: {
				devDependencies: {
					'@dojo/cli-build-webpack': '>=2.0.0-alpha.14',
					'copy-webpack-plugin': '^4.0.1',
					'css-loader': '^0.26.1',
					'dts-generator': '~1.7.0',
					'extract-text-webpack-plugin': '^2.0.0-rc.3',
					'file-loader': '^0.10.0',
					'html-loader': '^0.4.4',
					'html-webpack-plugin': '^2.28.0',
					'imports-loader': '^0.7.0',
					'json-css-module-loader': '^1.0.0',
					'loader-utils': '^1.0.2',
					'postcss-cssnext': '^2.9.0',
					'postcss-import': '^9.0.0',
					'postcss-loader': '^1.3.0',
					'source-map-loader': 'bryanforbes/source-map-loader#463701b',
					'style-loader': '^0.13.1',
					'ts-loader': '^2.0.0',
					'typed-css-modules': '^0.2.0',
					'typescript': 'rc',
					'umd-compat-loader': '^1.0.1',
					'webpack': '^2.2.1',
					'webpack-bundle-analyzer-sunburst': '^1.2.0',
					'webpack-dev-server': '^2.3.0'
				}
			},
			copy: {
				path: __dirname,
				files: [
					'./webpack.config.js'
				]
			}
		};

		return ejectOutput;
	}
};
export default command;
