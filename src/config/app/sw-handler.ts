const toolbox = require('sw-toolbox');

declare const SW_ROUTES: any[];

const routes = SW_ROUTES || [];
const strategies = {
	cacheFirst: toolbox.cacheFirst,
	networkFirst: toolbox.networkFirst,
	fastest: toolbox.fastest,
	cacheOnly: toolbox.cacheOnly,
	networkOnly: toolbox.networkOnly
};

routes.forEach(({ method, path, strategy, origin }) => {
	const options = {} as any;
	if (origin) {
		options.origin = origin;
	}
	toolbox.router[method](path, (strategies as any)[strategy], options);
});
