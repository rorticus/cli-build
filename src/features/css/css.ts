import CssModulePlugin from '@dojo/webpack-contrib/css-module-plugin/CssModulePlugin';
import * as path from 'path';
import { BuildType, FeatureConfiguration, FeatureGenerator } from '../../interfaces';
import { allPaths, basePath, mainEntry, srcPath } from '../../config/app/base';

const ExtractTextPlugin = require('extract-text-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');

const cssLoaders = [
	'@dojo/webpack-contrib/css-module-decorator-loader',
	`css-loader?modules&sourceMap&importLoaders=1&localIdentName=[hash:base64:8]`,
	{
		loader: 'postcss-loader?sourceMap',
		options: {
			plugins: [
				require('postcss-import')(),
				require('postcss-cssnext')({ features: { autoprefixer: { browsers: ['last 2 versions', 'ie >= 10'] } } })
			]
		}
	}
];

const cssFeature: FeatureGenerator = {
	getBaseConfig(): FeatureConfiguration {
		return {
			config: {
				entry: {
					[ mainEntry ]: [
						path.join(srcPath, 'main.css')
					]
				},
				plugins: [
					new CssModulePlugin(basePath)
				],
				module: {
					rules: [
						{
							include: allPaths,
							test: /.*\.ts?$/,
							enforce: 'pre',
							loader: '@dojo/webpack-contrib/css-module-dts-loader?type=ts&instanceName=0_dojo'
						},
						{
							include: allPaths,
							test: /.*\.m\.css?$/,
							enforce: 'pre',
							loader: '@dojo/webpack-contrib/css-module-dts-loader?type=css'
						},
						{
							test: /\.css$/,
							exclude: allPaths,
							use: ExtractTextPlugin.extract({
								fallback: ['style-loader'],
								use: ['css-loader?sourceMap']
							})
						},
						{ test: /\.m\.css.js$/, exclude: allPaths, use: ['json-css-module-loader'] },
						{
							include: allPaths,
							test: /.*\.css?$/,
							use: ExtractTextPlugin.extract({ fallback: ['style-loader'], use: cssLoaders })
						}
					]
				}
			}
		};
	},

	getBuildConfig(buildType: BuildType): FeatureConfiguration | null {
		if (buildType === BuildType.Prod) {
			return {
				config: {
					plugins: [
						new OptimizeCssAssetsPlugin({ cssProcessorOptions: { map: { inline: false } } })
					]
				}
			};
		}

		return null;
	}
};

export default cssFeature;
