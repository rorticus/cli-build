import webpack = require('webpack');
import NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
import Set from '@dojo/shim/Set';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { BuildArgs } from '../../main';

const IgnorePlugin = require('webpack/lib/IgnorePlugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const AutoRequireWebpackPlugin = require('auto-require-webpack-plugin');

const packagePath = '../../';
const basePath = process.cwd();
const packageJsonPath = path.join(basePath, 'package.json');
const packageJson = existsSync(packageJsonPath) ? require(packageJsonPath) : {};
const packageName = packageJson.name || '';
const packageVersion = packageJson.version || '1.0.0';
const tsLintPath = path.join(basePath, 'tslint.json');
const tsLint = existsSync(tsLintPath) ? require(tsLintPath) : {};

function getJsonpFunction(name: string) {
	name =  name.replace(/[^a-z0-9_]/g, ' ').trim().replace(/\s+/g, '_');
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

function webpackConfig(args: Partial<BuildArgs>) {
	args = args || {};

	const cssLoader = [ 'style-loader', 'css-loader?sourceMap' ];
	const localIdentName = '[hash:base64:8]';
	const cssModuleLoader = [
		'style-loader',
		'css-module-decorator-loader',
		`css-loader?modules&sourceMap&importLoaders=1&localIdentName=${localIdentName}`,
		{
			loader: 'postcss-loader?sourceMap',
			options: {
				plugins: [
					require('postcss-import')(),
					require('postcss-cssnext')({
						features: {
							autoprefixer: {
								browsers: [ 'last 2 versions', 'ie >= 10' ]
							}
						}
					})
				]
			}
		}
	];

	const replacedModules = new Set<string>();

	const config: webpack.Config = {
		entry: { 'src/main': [ path.join(basePath, 'src/main.css'), path.join(basePath, 'src/main.ts') ] },
		node: { dgram: 'empty', net: 'empty', tls: 'empty', fs: 'empty' },
		plugins: [
			new AutoRequireWebpackPlugin(/src\/main/),
			new webpack.BannerPlugin(readFileSync(require.resolve(`${packagePath}/banner.md`), 'utf8')),
			new IgnorePlugin(/request\/providers\/node/),
			new NormalModuleReplacementPlugin(/\.m.css$/, result => {
				const requestFileName = path.resolve(result.context, result.request);
				const jsFileName = requestFileName + '.js';
				if (replacedModules.has(requestFileName)) {
					replacedModules.delete(requestFileName);
				} else if (existsSync(jsFileName)) {
					replacedModules.add(requestFileName);
					result.request = result.request.replace(/\.m\.css$/, '.m.css.js');
				}
			})
		],
		output: {
			chunkFilename: '[name].js',
			library: '[name]',
			umdNamedDefine: true,
			filename: '[name].js',
			jsonpFunction: getJsonpFunction(packageName),
			libraryTarget: 'umd',
			path: path.resolve('./output')
		},
		devtool: 'source-map',
		resolve: { extensions: ['.ts', '.tsx', '.js'] },
		resolveLoader: { modules: [ path.join(__dirname, '../../loaders'), path.join(__dirname, '../../node_modules'), 'node_modules' ] },
		module: {
			rules: [
				{ test: /\.ts$/, enforce: 'pre', loader: 'tslint-loader', options: { configuration: tsLint, emitErrors: true, failOnHint: true } },
				{ test: /@dojo\/.*\.js$/, enforce: 'pre', loader: 'source-map-loader-cli', options: { includeModulePaths: true } },
				{ test: /src[\\\/].*\.ts?$/, enforce: 'pre', loader: 'css-module-dts-loader?type=ts&instanceName=0_dojo' },
				{ test: /src[\\\/].*\.m\.css?$/, enforce: 'pre', loader: 'css-module-dts-loader?type=css' },
				{ test: /src[\\\/].*\.ts(x)?$/, use: [
					getUMDCompatLoader({ bundles: args.bundles }),
					{ loader: 'ts-loader', options: { instance: 'dojo' } }
				]},
				{ test: /\.js?$/, loader: 'umd-compat-loader' },
				{ test: new RegExp(`globalize(\\${path.sep}|$)`), loader: 'imports-loader?define=>false' },
				{ test: /.*\.(gif|png|jpe?g|svg|eot|ttf|woff|woff2)$/i, loader: 'file-loader?hash=sha512&digest=hex&name=[hash:base64:8].[ext]' },
				{ test: /\.css$/, exclude: /src[\\\/].*/, use: cssLoader },
				{ test: /src[\\\/].*\.css?$/, use: cssModuleLoader },
				{ test: /\.m\.css.js$/, exclude: /src[\\\/].*/, use: ['json-css-module-loader'] }
			]
		}
	};

	return config;
}

export default webpackConfig;
