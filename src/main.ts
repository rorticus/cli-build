import { Command, Helper, OptionsHelper } from '@dojo/interfaces/cli';
import webpack = require('webpack');
const WebpackDevServer: any = require('webpack-dev-server');
import prodConfig from './config/app/prod';
import devConfig from './config/app/dev';

const fixMultipleWatchTrigger = require('webpack-mild-compile');

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

function watch(config: webpack.Config, options: WebpackOptions, args: BuildArgs): Promise<void> {
	const compiler = webpack(config);
	fixMultipleWatchTrigger(compiler);
	const server = new WebpackDevServer(compiler, options);
	const serverPort = (config as any).devServer.port;
	return new Promise<void>((resolve, reject) => {
		server.listen(serverPort, '127.0.0.1', (err: Error) => {
			console.log(`Starting server on http://localhost:${serverPort}`);
			if (err) {
				reject(err);
				return;
			}
		});
	});
}

const command: Command<BuildArgs> = {
	group: 'build',
	name: 'webpack',
	description: 'create a build of your application',
	register(options: OptionsHelper): void {
		options('dev', {
			describe: 'watch',
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
		if (args.dev) {
			return watch(devConfig(configArgs), options, args);
		}
		return compile(prodConfig(configArgs), options, args);
	}
};
export default command;
