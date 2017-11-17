import { Configuration } from 'webpack';

export enum BuildType {
	Prod = 'prod',
	Dev = 'dev'
}

export interface Bundles {
	[key: string]: string[];
}

export interface BuildArgs {
	[index: string]: any;
	bundles: Bundles;
	force: boolean;
}

export interface FeatureConfiguration {
	strategy?: any;
	config: Partial<Configuration>;
}

export interface FeatureGenerator {
	getBaseConfig(args: Partial<BuildArgs>): FeatureConfiguration | FeatureConfiguration[] | null;
	getBuildConfig?(buildType: BuildType, args: Partial<BuildArgs>): FeatureConfiguration | FeatureConfiguration[] | null;
}
