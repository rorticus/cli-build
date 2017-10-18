import webpack = require('webpack');
import Set from '@dojo/shim/Set';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { BuildArgs } from '../../main';

const IgnorePlugin = require('webpack/lib/IgnorePlugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const AutoRequireWebpackPlugin = require('auto-require-webpack-plugin');
const OfflinePlugin = require('offline-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const basePath = process.cwd();
const srcPath = path.join(basePath, 'src');
const testPath = path.join(basePath, 'tests');
const allPaths = [ srcPath,  testPath ];
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

class BuildTimeRender {
	private _paths: any[];
	private _disabled = false;
	private _root: string;

	constructor(args = { paths: [], root: '' }) {
		this._paths = [ '', ...args.paths ];
		this._root = args.root;
		if (args.root === '') {
			this._disabled = true;
		}
	}

	private _render(compiler: webpack.Compiler, location: string, htmlContent: string, root: string) {
		const output = compiler.options.output && compiler.options.output.path || basePath;
		const window: any = (new JSDOM(htmlContent, { runScripts: 'outside-only' })).window;
		const document: any = window.document;
		const parent = document.getElementById(root);
		const entry = readFileSync(path.join(output, mainEntry + '.js'), 'utf-8');
		window.eval(`
window.location.hash = '${location}';
window.DojoHasEnvironment = { staticFeatures: { 'build-time-render': true } };
window.requestAnimationFrame = function() {};
window.cancelAnimationFrame = function() {};
		`);
		window.eval(entry);

		const treeWalker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_ELEMENT);
		let classes: string[] = [];

		while (treeWalker.nextNode()) {
			const node: any = treeWalker.currentNode;
			node.classList.length && classes.push.apply(classes, node.classList);
		}

		classes = classes.map((className) => `.${className}`);
		return { html: parent.outerHTML, classes };
	}

	apply(compiler: webpack.Compiler) {
		if (this._disabled) {
			return;
		}
		compiler.plugin('done', () => {
			const output = compiler.options.output && compiler.options.output.path || basePath;
			let htmlContent = readFileSync(path.join(output, 'index.html'), 'utf-8');
			const filterCss = require('filter-css');

			let html: string[] = [];
			let classes: string[] = [];

			this._paths.forEach((path) => {
				path = typeof path === 'object' ? path.path : path;
				const result = this._render(compiler, path, htmlContent, this._root);
				classes = [ ...classes, ...result.classes ];
				html = [ ...html, result.html ];
			});

			const result = filterCss(path.join(output, mainEntry + '.css'), (context: any, value: any, node: any) => {
				if (context === 'selector') {
					value = value.replace(/(:| ).*/, '');
					const firstChar = value.substr(0, 1);
					if (classes.indexOf(value) !== -1 || [ '.', '#' ].indexOf(firstChar) === -1) {
						return false;
					}
					return true;
				}
			}).replace(/\/\*# sourceMappingURL\=.*/, '');

			const replacement = `
<script>
	(function () {
		var paths = ${JSON.stringify(this._paths)};
		var html = ${JSON.stringify(html)};
		var element = document.getElementById('${this._root}');
		var target;
		paths.some(function (path, i) {
			target = html[i];
			return path && ((typeof path === 'string' && path === window.location.hash) || (typeof path === 'object' && path.match && new RegExp(path.match.join('|')).test(window.location.hash)));
		});
		if (target && element) {
			var frag = document.createRange().createContextualFragment(target);
			element.parentNode.replaceChild(frag, element);
		}
	}())
</script>
`;
			const script = `<script type="text/javascript" src="${mainEntry}.js"></script>`;
			const css = `<link rel="stylesheet" href="${mainEntry}.css" media="none" onload="if(media!='all')media='all'" />`;

			htmlContent = htmlContent.replace(`<link href="${mainEntry}.css" rel="stylesheet">`, `<style>${result}</style>`);
			htmlContent = htmlContent.replace(script, `${replacement}${css}${script}`);
			writeFileSync(path.join(output, 'index.html'), htmlContent);
		});
	}
}

function webpackConfig(args: Partial<BuildArgs>) {
	args = args || {};
	const serviceWorker = args.pwa && args.pwa.serviceWorker && {
		...{ ServiceWorker: { entry: path.join(__dirname, './sw-handler.js') } }
		, ...args.pwa.serviceWorker,
		AppCache: false
	};
	const manifest = args.pwa && args.pwa.manifest;
	const buildTimeRender = !args['watch-serve'] && args.buildTimeRender;

	const config: webpack.Configuration = {
		entry: {
			[ mainEntry ]: removeEmpty([
				serviceWorker && path.join(__dirname, 'sw.js'),
				path.join(__dirname, 'btr.js'),
				path.join(srcPath, 'main.css'),
				path.join(srcPath, 'main.ts')
			])
		},
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
			new ExtractTextPlugin({ filename: 'src/main.css', allChunks: true }),
			new HtmlWebpackPlugin({ inject: 'body', chunks: [ mainEntry ], template: path.join(srcPath, 'index.html') }),
			serviceWorker && new OfflinePlugin(serviceWorker),
			manifest && new WebpackPwaManifest(manifest),
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
		devServer: {
			port: 8888
		},
		devtool: 'source-map',
		watchOptions: { ignored: /node_modules/ },
		resolve: {
			modules: [ basePath, path.join(basePath, 'node_modules') ],
			extensions: ['.ts', '.tsx', '.js'] },
		resolveLoader: { modules: [ path.join(__dirname, '../../loaders'), path.join(__dirname, '../../node_modules'), 'node_modules' ] },
		module: {
			rules: removeEmpty([
				tsLint && { test: /\.ts$/, enforce: 'pre', loader: 'tslint-loader', options: { configuration: tsLint, emitErrors: true, failOnHint: true } },
				{ test: /@dojo\/.*\.js$/, enforce: 'pre', loader: 'source-map-loader-cli', options: { includeModulePaths: true } },
				{ include: allPaths, test: /.*\.ts?$/, enforce: 'pre', loader: 'css-module-dts-loader?type=ts&instanceName=0_dojo' },
				{ include: allPaths, test: /.*\.m\.css?$/, enforce: 'pre', loader: 'css-module-dts-loader?type=css' },
				{ include: allPaths, test: /.*\.ts(x)?$/, use: [ getUMDCompatLoader({ bundles: args.bundles }), { loader: 'ts-loader', options: { instance: 'dojo' } } ]},
				{ include: allPaths, test: /.*\.css?$/, use: ExtractTextPlugin.extract({ use: getCSSModuleLoader() }) },
				{ test: /\.js?$/, loader: 'umd-compat-loader' },
				{ test: new RegExp(`globalize(\\${path.sep}|$)`), loader: 'imports-loader?define=>false' },
				{ test: /.*\.(gif|png|jpe?g|svg|eot|ttf|woff|woff2)$/i, loader: 'file-loader?hash=sha512&digest=hex&name=[hash:base64:8].[ext]' },
				{ test: /\.css$/, exclude: allPaths, use: ExtractTextPlugin.extract({ use: [ 'css-loader?sourceMap' ] }) },
				{ test: /\.m\.css.js$/, exclude: allPaths, use: ['json-css-module-loader'] }
			])
		}
	};

	return config;
}

export default webpackConfig;
