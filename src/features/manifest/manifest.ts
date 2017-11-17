import { BuildArgs, FeatureConfiguration, FeatureGenerator } from '../../interfaces';
import WebpackPwaManifest = require('webpack-pwa-manifest');

const manifest: FeatureGenerator = {
	getBaseConfig(args: Partial<BuildArgs>): FeatureConfiguration | null {
		const manifest = args.pwa && args.pwa.manifest;

		if (!manifest) {
			return null;
		}
		else {
			return {
				config: {
					plugins: [
						new WebpackPwaManifest(manifest)
					]
				}
			};
		}
	}
};

export default manifest;
