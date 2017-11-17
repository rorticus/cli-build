import webpack = require('webpack');
import { existsSync } from 'fs';
import * as path from 'path';
import { BuildArgs } from '../../interfaces';
import BuildTimeRender from './BuildTimeRender';

const IgnorePlugin = require('webpack/lib/IgnorePlugin');
const AutoRequireWebpackPlugin = require('auto-require-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

export const basePath = process.cwd();
export const srcPath = path.join(basePath, 'src');
export const testPath = path.join(basePath, 'tests');
export const allPaths = [srcPath, testPath];
export const mainEntry = 'src/main';
const packageJsonPath = path.join(basePath, 'package.json');
const packageJson = existsSync(packageJsonPath) ? require(packageJsonPath) : {};
const packageName = packageJson.name || '';
const tsLintPath = path.join(basePath, 'tslint.json');
const tsLint = existsSync(tsLintPath) ? require(tsLintPath) : false;

function getJsonpFunctionName(name: string) {
	name = name.replace(/[^a-z0-9_]/g, ' ').trim().replace(/\s+/g, '_');
	return `dojoWebpackJsonp${name}`;
}

function getUMDCompatLoader(options: { bundles?: { [key: string ]: string[] } }) {
	const { bundles = {} } = options;
	return {
		loader: 'umd-compat-loader',
		options: {
			imports(module: string, context: string) {
				const filePath = path.relative(basePath, path.join(context, module));
				let chunkName = filePath;
				Object.keys(bundles).some((name) => {
					if (bundles[name].indexOf(filePath) > -1) {
						chunkName = name;
						return true;
					}
					return false;
				});
				return `promise-loader?global,${chunkName}!${module}`;
			}
		}
	};
}

const removeEmpty = (items: any[]) => items.filter((item) => item);

function webpackConfig(args: Partial<BuildArgs>) {
	args = args || {};
	const buildTimeRender = !args['watch-serve'] && args.buildTimeRender;

	const config: webpack.Configuration = {
		entry: {
			[ mainEntry ]: removeEmpty([
				buildTimeRender && path.join(__dirname, 'btr.js'),
				path.join(srcPath, 'main.ts')
			])
		},
		node: { dgram: 'empty', net: 'empty', tls: 'empty', fs: 'empty' },
		plugins: removeEmpty([
			new AutoRequireWebpackPlugin(mainEntry),
			new IgnorePlugin(/request\/providers\/node/),
			new ExtractTextPlugin({ filename: 'src/main.css', allChunks: true, disable: true }),
			buildTimeRender && new BuildTimeRender(buildTimeRender)
		]),
		output: {
			chunkFilename: '[name].js',
			library: '[name]',
			umdNamedDefine: true,
			filename: '[name].js',
			jsonpFunction: getJsonpFunctionName(packageName),
			libraryTarget: 'umd',
			path: path.resolve('./output')
		},
		devServer: { port: 8888 },
		devtool: 'source-map',
		watchOptions: { ignored: /node_modules/ },
		resolve: {
			modules: [basePath, path.join(basePath, 'node_modules')],
			extensions: ['.ts', '.tsx', '.js']
		},
		resolveLoader: {
			modules: [path.join(__dirname, '../../loaders'), path.join(__dirname, '../../node_modules'), 'node_modules']
		},
		module: {
			rules: removeEmpty([
				tsLint && {
					test: /\.ts$/,
					enforce: 'pre',
					loader: 'tslint-loader',
					options: { configuration: tsLint, emitErrors: true, failOnHint: true }
				},
				{
					test: /@dojo\/.*\.js$/,
					enforce: 'pre',
					loader: 'source-map-loader-cli',
					options: { includeModulePaths: true }
				},
				{
					include: allPaths,
					test: /.*\.ts(x)?$/,
					use: [getUMDCompatLoader({ bundles: args.bundles }), {
						loader: 'ts-loader',
						options: { instance: 'dojo' }
					}]
				},
				{ test: /\.js?$/, loader: 'umd-compat-loader' },
				{ test: new RegExp(`globalize(\\${path.sep}|$)`), loader: 'imports-loader?define=>false' },
				{
					test: /.*\.(gif|png|jpe?g|svg|eot|ttf|woff|woff2)$/i,
					loader: 'file-loader?hash=sha512&digest=hex&name=[hash:base64:8].[ext]'
				}
			])
		}
	};

	return config;
}

export default webpackConfig;
