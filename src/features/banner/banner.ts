import { FeatureConfiguration, FeatureGenerator } from '../../interfaces';
import webpack = require('webpack');

const bannerString = `
[Dojo](https://dojo.io/)
Copyright [JS Foundation](https://js.foundation/) & contributors
[New BSD license](https://github.com/dojo/meta/blob/master/LICENSE)
All rights reserved
`;

const banner: FeatureGenerator = {
	getBaseConfig(): FeatureConfiguration {
		return {
			config: {
				plugins: [
					new webpack.BannerPlugin(bannerString)
				]
			}
		};
	}
};

export default banner;
