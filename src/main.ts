import { Command, Helper, OptionsHelper } from '@dojo/interfaces/cli';
import webpack = require('webpack');
import prodConfig from './config/app/prod';
import devConfig from './config/app/dev';

const fixMultipleWatchTrigger = require('webpack-mild-compile');
const express = require('express');
const webpackMiddleware = require('webpack-dev-middleware');
const columns = require('cli-columns');
const logUpdate = require('log-update');
const ora = require('ora');
const logSymbols = require('log-symbols');
const chalk = require('chalk');
const typescript = require('typescript');
const version = require('./package.json').version;

export interface Bundles {
	[key: string]: string[];
}

export interface BuildArgs {
	[index: string]: any;
	bundles: Bundles;
	force: boolean;
}

interface ConfigFactory {
	(args: Partial<BuildArgs>): webpack.Configuration;
}

interface WebpackOptions {
	compress?: boolean;
	stats?: any;
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

function compile(config: webpack.Configuration, options: WebpackOptions, args: BuildArgs): Promise<void> {
	const compiler = webpack(config);
	fixMultipleWatchTrigger(compiler);
	logUpdate('');
	if (args.watch) {
		const spinner = ora('building');
		compiler.plugin('invalid', () => {
			logUpdate('');
			spinner.start();
		});
		compiler.plugin('done', (stats) => {
			spinner.stop();
		});
		spinner.start();
		return new Promise<void>((resolve, reject) => {
			compiler.watch((config as any).watchOptions, (err: any, stats: any) => {
				logStats(stats, config);
			});
		});
	}
	return new Promise<void>((resolve, reject) => {
		const spinner = ora('building').start();
		compiler.run((err, stats) => {
			if (err) {
				reject(err);
				return;
			}
			if (stats) {
				spinner.stop();
				logStats(stats, config);

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

function logStats(stats: any, config: any, serve = false) {
	const assets = Object.keys(stats.compilation.assets).map((name) => {
		const size = (stats.compilation.assets[name].size() / 1000).toFixed(2);
		return `${name} ${chalk.yellow(`(${size}kb)`)}`;
	});
	logUpdate(`
${logSymbols.info} cli-build: ${version}
${logSymbols.info} typescript: ${typescript.version}
${logSymbols.success} hash: ${stats.hash}
${logSymbols.error} errors: ${stats.compilation.errors.length}
${logSymbols.warning} warnings: ${stats.compilation.warnings.length}

${chalk.yellow('assets:')}
${columns(assets)}

${chalk.yellow(serve ? `served at: ${chalk.cyan(chalk.underline('http://localhost:8888'))}` : `output at: ${chalk.cyan(chalk.underline(`file:///${config.output.path}`))}`)}
	`);
}

function watch(config: webpack.Configuration, options: WebpackOptions, args: BuildArgs): Promise<void> {
	const app = express();
	(config as any).plugins.push(new webpack.HotModuleReplacementPlugin());
	Object.keys(config.entry).forEach((name) => {
		(config as any).entry[name].push('webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000');
	});
	const compiler = webpack(config);
	const spinner = ora('building');
	compiler.plugin('done', (stats) => {
		spinner.stop();
		logStats(stats, config, true);
	});
	compiler.plugin('invalid', () => {
		logUpdate('');
		spinner.start();
	});
	fixMultipleWatchTrigger(compiler);
	app.use(webpackMiddleware(compiler, {
		noInfo: true,
		quiet: true,
		serverSideRender: false
	}));
	app.use(require('webpack-hot-middleware')(compiler, {
		log: console.log, path: '/__webpack_hmr', heartbeat: 10 * 1000
	}));
	return new Promise((resolve) => {
		app.listen((config as any).devServer.port, '127.0.0.1', function(err: any) {
			logUpdate('');
			spinner.start();
		});
	});
}

const command: Command<BuildArgs> = {
	group: 'build',
	name: 'webpack',
	description: 'create a build of your application',
	register(options: OptionsHelper): void {
		options('dev', {
			describe: 'dev',
			default: false,
			type: 'boolean'
		});
		options('watch', {
			describe: 'watch',
			default: false,
			type: 'boolean'
		});
		options('watch-serve', {
			describe: 'watch-serve',
			default: false,
			type: 'boolean'
		});
	},
	run(helper: Helper, args: BuildArgs): Promise<void> {
		console.log = () => {};
		const dojoRc = helper.configuration.get() || Object.create(null);
		const options: WebpackOptions = {
			compress: true,
			stats: 'minimal'
		};
		const configArgs = mergeConfigArgs(dojoRc as BuildArgs, args);
		configArgs.basePath = process.cwd();
		let config;
		if (args.dev) {
			config = devConfig;
		}
		else {
			config = prodConfig;
		}
		if (args['watch-serve']) {
			return watch(config(configArgs), options, args);
		}
		else {
			return compile(config(configArgs), options, args);
		}
	}
};
export default command;
