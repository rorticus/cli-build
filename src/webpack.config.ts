const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer-sunburst').BundleAnalyzerPlugin;
const path = require('path');
const CoreLoadPlugin = require('./plugins/CoreLoadPlugin').default;
const I18nPlugin = require('./plugins/I18nPlugin').default;
const InjectModulesPlugin = require('./plugins/InjectModulesPlugin').default;
const basePath = process.cwd();
const postcssImport = require('postcss-import');
const postcssCssNext = require('postcss-cssnext');
const cssLoader = ExtractTextPlugin.extract([ 'css-loader?sourceMap' ]);
const cssModuleIdent = '[name]__[local]__[hash:base64:5]';
const cssModuleLoader = ExtractTextPlugin.extract([
	`css-loader?modules&sourceMap&localIdentName=${cssModuleIdent}&importLoaders=1`,
	'postcss-loader?sourceMap'
]);

module.exports = function (args: any) {
	args = args || {};

	function includeWhen(predicate: boolean, callback: any) {
		return predicate ? callback(args) : [];
	}

	return {
		externals: [
			function (context: any, request: any, callback: any) {
				if (/^intern[!\/]/.test(request)) {
					return callback(null, 'amd ' + request);
				}
				callback();
			}
		],
		entry: {
			[args.out]: [ `${__dirname}/templates/custom-component.js` ]
		},
		plugins: [
			new webpack.ContextReplacementPlugin(/dojo-app[\\\/]lib/, { test: () => false }),
			new ExtractTextPlugin(`${args.out}.css`),
			new CopyWebpackPlugin([
				{ context: 'src', from: '**/*', ignore: [ '*.ts', '*.css', '*.html' ] }
			]),
			new webpack.optimize.DedupePlugin(),
			new InjectModulesPlugin({
				resourcePattern: /dojo-core\/request(\.js)?$/,
				moduleIds: [ './request/xhr' ]
			}),
			new CoreLoadPlugin(),
			// new webpack.optimize.UglifyJsPlugin({ compress: { warnings: false }, exclude: /tests[/]/ }),
			new HtmlWebpackPlugin ({
				inject: false,
				template: path.join(__dirname, 'templates/custom-component.html'),
				filename: `${args.out}.html`
			}),
			...includeWhen(args.locale, (args: any) => {
				return [
					new I18nPlugin({
						defaultLocale: args.locale,
						supportedLocales: args.supportedLocales,
						messageBundles: args.messagesBundles
					})
				];
			}),
			...includeWhen(!args.watch, (args: any) => {
				return [
					new BundleAnalyzerPlugin({
						analyzerMode: 'static',
						openAnalyzer: false,
						reportType: 'sunburst'
					})
				];
			})
		],
		postcss: [
			postcssImport,
			postcssCssNext({
				features: {
					autoprefixer: {
						browsers: [ 'last 2 versions', 'ie >= 10' ]
					}
				}
			})
		],
		output: {
			libraryTarget: 'umd',
			path: path.resolve('./dist'),
			filename: '[name].js'
		},
		devtool: 'source-map',
		resolve: {
			root: [ basePath, path.join(basePath, 'node_modules') ],
			extensions: ['', '.ts', '.js']
		},
		resolveLoader: {
			root: [ path.join(__dirname, 'node_modules') ]
		},
		module: {
			preLoaders: [
				{ test: /@dojo\/.*\.js$/, loader: 'source-map-loader' }
			],
			loaders: [
				{ test: /src[\\\/].*\.ts?$/, loader: 'umd-compat-loader!ts-loader' },
				{ test: /\.js?$/, loader: 'umd-compat-loader' },
				{ test: /globalize(\/|$)/, loader: 'imports-loader?define=>false' },
				{ test: /src[\\\/].*\.css?$/, loader: cssModuleLoader },
				{ test: /\.css$/, exclude: /src[\\\/].*/, loader: cssLoader },
				{ test: /styles\/.*\.js$/, exclude: /src[\\\/].*/, loader: 'json-css-module-loader' },
				{
					test: /custom-component\.js/,
					loader: `imports-loader?widgetFactory=${args.factory}`
				}
			]
		}
	};
};
