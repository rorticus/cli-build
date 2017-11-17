import * as path from 'path';
import { BuildArgs, FeatureConfiguration, FeatureGenerator } from '../../interfaces';
import webpack = require('webpack');
import { mainEntry } from '../../config/app/base';

const OfflinePlugin = require('offline-plugin');

const serviceWorker: FeatureGenerator = {
	getBaseConfig(buildArgs: Partial<BuildArgs>): FeatureConfiguration | null {
		const serviceWorker = buildArgs.pwa && buildArgs.pwa.serviceWorker && {
			...{ ServiceWorker: { entry: path.resolve(path.join(__dirname, '../../config/app/', 'sw-handler.js')) } }
			, ...buildArgs.pwa.serviceWorker,
			AppCache: false
		};

		if (!serviceWorker) {
			return null;
		}
		else {
			return {
				config: {
					entry: {
						[mainEntry]: [
							path.resolve(path.join(__dirname, '../../config/app/', 'sw.js'))
						]
					},
					plugins: [
						new webpack.DefinePlugin({ SW_ROUTES: JSON.stringify(serviceWorker.request || []) }),
						new OfflinePlugin(serviceWorker)
					]
				}
			};
		}
	}
};

export default serviceWorker;
