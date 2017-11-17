import { Command, Helper, OptionsHelper } from '@dojo/interfaces/cli';
import { isArrayLike } from '@dojo/shim/iterator';
import * as fs from 'fs';
import devConfig from './config/app/dev';
import prodConfig from './config/app/prod';
import testConfig from './config/app/test';

import banner from './features/banner/banner';
import css from './features/css/css';
import manifest from './features/manifest/manifest';
import serviceWorker from './features/serviceworker/serviceworker';
import { BuildArgs, BuildType, FeatureConfiguration, FeatureGenerator } from './interfaces';
import webpack = require('webpack');

const features: FeatureGenerator[] = [banner, css, manifest, serviceWorker];

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
const stripAnsi = require('strip-ansi');
const gzipSize = require('gzip-size');
const merge = require('webpack-merge');

interface ConfigFactory {
	(args: Partial<BuildArgs>): webpack.Configuration;
}

function mergeFeatureConfig(config: webpack.Configuration, featureConfig: FeatureConfiguration | FeatureConfiguration[] | null): webpack.Configuration {
	if (!featureConfig) {
		return config;
	}

	if (isArrayLike(featureConfig)) {
		let mergedConfig = config;

		for (let i = 0; i < featureConfig.length; i++) {
			mergedConfig = mergeFeatureConfig(mergedConfig, featureConfig[i]);
		}

		return mergedConfig;
	}
	else {
		return merge(config, featureConfig.config);
	}
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

function compile(config: webpack.Configuration, options: any, args: BuildArgs): Promise<void> {
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
			compiler.watch((config as any).watchOptions, (err: any, stats) => {
				!args.quiet && logStats(stats.toJson(), config);
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
				!args.quiet && logStats(stats.toJson(), config);
			}
			resolve();
		});
	});
}

function logStats(stats: any, config: any, serve = false) {
	const assets = stats.assets.map((asset: any) => {
		if (asset.name.match(/\.hot-update\.js/)) {
			return undefined;
		}
		if (!serve) {
			const size = (asset.size / 1000).toFixed(2);
			const content = fs.readFileSync(config.output.path + '/' + asset.name, 'utf-8');
			const compressedSize = (gzipSize.sync(content) / 1000).toFixed(2);
			return `${asset.name} ${chalk.yellow(`(${size}kb)`)} / ${chalk.blue(`(${compressedSize}kb gz)`)}`;
		}
		return asset.name;
	}).filter((output: string) => output);

	const chunks = stats.chunks.map((chunk: any) => {
		return `${chunk.names[0]}`;
	});

	const errors = stats.errors.length ? `
${chalk.yellow('errors:')}
${chalk.red(stats.errors.map((error: string) => stripAnsi(error)))}
` : '';

	const warnings = stats.warnings.length ? `
${chalk.yellow('warnings:')}
${chalk.gray(stats.warnings.map((warning: string) => stripAnsi(warning)))}
` : '';

	logUpdate(`
${logSymbols.info} cli-build-app: ${version}
${logSymbols.info} typescript: ${typescript.version}
${logSymbols.success} hash: ${stats.hash}
${logSymbols.error} errors: ${stats.errors.length}
${logSymbols.warning} warnings: ${stats.warnings.length}
${errors}${warnings}
${chalk.yellow('chunks:')}
${columns(chunks)}

${chalk.yellow('assets:')}
${columns(assets)}

${chalk.yellow(serve ? `served at: ${chalk.cyan(chalk.underline('http://localhost:8888'))}` : `output at: ${chalk.cyan(chalk.underline(`file:///${config.output.path}`))}`)}
	`);
}

function watch(config: webpack.Configuration, options: any, args: BuildArgs) {
	const app = express();
	(config as any).plugins.push(new webpack.HotModuleReplacementPlugin());
	Object.keys(config.entry).forEach((name) => {
		(config as any).entry[name].unshift(__dirname + '/client?path=/__webpack_hmr&timeout=20000&reload=true');
	});
	const compiler = webpack(config);
	const spinner = ora('building');
	compiler.plugin('done', (stats) => {
		spinner.stop();
		args.quiet && logStats(stats.toJson(), config, true);
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
		app.listen((config as any).devServer.port, '127.0.0.1', function (err: any) {
			logUpdate('');
			spinner.start();
		});
	});
}

const command: Command<BuildArgs> = {
	group: 'build',
	name: 'webpack',
	description: 'create a build of your application',
	register(options: OptionsHelper) {
		options('dev', {
			describe: 'dev',
			default: false,
			type: 'boolean'
		});
		options('test', {
			describe: 'test',
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
		options('quiet', {
			describe: 'quiet',
			default: false,
			type: 'boolean'
		});
	},
	run(helper: Helper, args: BuildArgs) {
		console.log = () => {
		};
		const dojoRc = helper.configuration.get() || Object.create(null);
		const options = {
			compress: true,
			stats: 'minimal'
		};
		const configArgs = mergeConfigArgs(dojoRc as BuildArgs, args);
		configArgs.basePath = process.cwd();
		let config;
		let isProd = true;
		if (args.test) {
			config = testConfig;
			isProd = false;
		}
		else if (args.dev) {
			config = devConfig;
			isProd = false;
		}
		else {
			config = prodConfig;
		}

		let finalConfig = config(configArgs);
		// base configs for each feature
		features.forEach(feature => {
			finalConfig = mergeFeatureConfig(finalConfig, feature.getBaseConfig(configArgs));
		});

		features.forEach(feature => {
			if (feature.getBuildConfig) {
				finalConfig = mergeFeatureConfig(finalConfig, feature.getBuildConfig(isProd ? BuildType.Prod : BuildType.Dev, configArgs));
			}
		});

		if (args['watch-serve']) {
			return watch(finalConfig, options, args);
		}
		else {
			return compile(finalConfig, options, args);
		}
	}
};
export default command;
