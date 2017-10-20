import webpack = require('webpack');
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const basePath = process.cwd();
const mainEntry = 'src/main';

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

export default BuildTimeRender;
