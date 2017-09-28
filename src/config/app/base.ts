import webpack = require('webpack');
import Set from '@dojo/shim/Set';
import { existsSync } from 'fs';
import * as path from 'path';
import { BuildArgs } from '../../main';

const IgnorePlugin = require('webpack/lib/IgnorePlugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const AutoRequireWebpackPlugin = require('auto-require-webpack-plugin');
const OfflinePlugin = require('offline-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');

const basePath = process.cwd();
const srcPath = path.join(basePath, 'src');
const mainEntry = 'src/main';
const packageJsonPath = path.join(basePath, 'package.json');
const packageJson = existsSync(packageJsonPath) ? require(packageJsonPath) : {};
const packageName = packageJson.name || '';
const tsLintPath = path.join(basePath, 'tslint.json');
const tsLint = existsSync(tsLintPath) ? require(tsLintPath) : false;

const banner = `
[Dojo](https://dojo.io/)
Copyright [JS Foundation](https://js.foundation/) & contributors
[New BSD license](https://github.com/dojo/meta/blob/master/LICENSE)
All rights reserved
`;

function getJsonpFunctionName(name: string) {
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

function getCSSReplacerPlugin() {
	const replacedModules = new Set<string>();
	return new webpack.NormalModuleReplacementPlugin(/\.m.css$/, (result: any) => {
		const requestFileName = path.resolve(result.context, result.request);
		const jsFileName = requestFileName + '.js';
		if (replacedModules.has(requestFileName)) {
			replacedModules.delete(requestFileName);
		} else if (existsSync(jsFileName)) {
			replacedModules.add(requestFileName);
			result.request = result.request.replace(/\.m\.css$/, '.m.css.js');
		}
	});
}

function getCSSModuleLoader() {
	const localIdentName = '[hash:base64:8]';
	return [
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
}

const removeEmpty = (items: any[]) => items.filter((item) => item);

function webpackConfig(args: Partial<BuildArgs>) {
	args = args || {};
	const serviceWorker = args.pwa && args.pwa.serviceWorker && { ...{ ServiceWorker: { entry: path.join(__dirname, './sw-handler.js') } }, ...args.pwa.serviceWorker, AppCache: false };
	const manifest = args.pwa && args.pwa.manifest;

	const config: webpack.Configuration = {
		entry: { [ mainEntry ]: removeEmpty([ path.join(srcPath, 'main.css'), path.join(srcPath, 'main.ts'), serviceWorker && path.join(__dirname, 'sw.js') ]) },
		node: { dgram: 'empty', net: 'empty', tls: 'empty', fs: 'empty' },
		plugins: removeEmpty([
			serviceWorker && new webpack.DefinePlugin({
				'SW_ROUTES': JSON.stringify(serviceWorker.request || [])
			}),
			new AutoRequireWebpackPlugin(mainEntry),
			new webpack.BannerPlugin(banner),
			new IgnorePlugin(/request\/providers\/node/),
			getCSSReplacerPlugin(),
			new CopyWebpackPlugin([ { context: srcPath, from: '**/*', ignore: '*.ts' } ]),
			new HtmlWebpackPlugin({ inject: true, chunks: [ mainEntry ], template: path.join(srcPath, 'index.html') }),
			serviceWorker && new OfflinePlugin(serviceWorker),
			manifest && new WebpackPwaManifest(manifest)
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
		devServer: {
			port: 8888
		},
		devtool: 'source-map',
		watchOptions: { ignored: /node_modules/ },
		resolve: { extensions: ['.ts', '.tsx', '.js'] },
		resolveLoader: { modules: [ path.join(__dirname, '../../loaders'), path.join(__dirname, '../../node_modules'), 'node_modules' ] },
		module: {
			rules: removeEmpty([
				tsLint && { test: /\.ts$/, enforce: 'pre', loader: 'tslint-loader', options: { configuration: tsLint, emitErrors: true, failOnHint: true } },
				{ test: /@dojo\/.*\.js$/, enforce: 'pre', loader: 'source-map-loader-cli', options: { includeModulePaths: true } },
				{ include: srcPath, test: /.*\.ts?$/, enforce: 'pre', loader: 'css-module-dts-loader?type=ts&instanceName=0_dojo' },
				{ include: srcPath, test: /.*\.m\.css?$/, enforce: 'pre', loader: 'css-module-dts-loader?type=css' },
				{ include: srcPath, test: /.*\.ts(x)?$/, use: [ getUMDCompatLoader({ bundles: args.bundles }), { loader: 'ts-loader', options: { instance: 'dojo' } } ]},
				{ include: srcPath, test: /.*\.css?$/, use: getCSSModuleLoader() },
				{ test: /\.js?$/, loader: 'umd-compat-loader' },
				{ test: new RegExp(`globalize(\\${path.sep}|$)`), loader: 'imports-loader?define=>false' },
				{ test: /.*\.(gif|png|jpe?g|svg|eot|ttf|woff|woff2)$/i, loader: 'file-loader?hash=sha512&digest=hex&name=[hash:base64:8].[ext]' },
				{ test: /\.css$/, exclude: srcPath, use: [ 'style-loader', 'css-loader?sourceMap' ] },
				{ test: /\.m\.css.js$/, exclude: srcPath, use: ['json-css-module-loader'] }
			])
		}
	};

	return config;
}

export default webpackConfig;
