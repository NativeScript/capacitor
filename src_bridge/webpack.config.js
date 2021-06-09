const webpack = require("@nativescript/webpack");
const TerserPlugin = require("terser-webpack-plugin");
const { resolve } = require("path");
module.exports = (env) => {
  const mode = env.production ? 'production' : 'development';
  const distFolder = env.distFolder || 'www';
  webpack.init(env);
  webpack.useConfig(false);
  webpack.chainWebpack((config) => {
    const platform = webpack.Utils.platform.getPlatformName();
    const projectDir = webpack.Utils.project.getProjectRootPath();
    const tsConfigPath = webpack.Utils.project.getProjectFilePath(
      "./tsconfig.json"
    );
    config.mode(mode);
    config.devtool(false);
    config
      .entry("index")
      .add(
        webpack.Utils.project.getProjectFilePath("./index.ts")
      );
    config.output
      .path(webpack.Utils.project.getProjectFilePath(`../../${distFolder}/nativescript`))
      .pathinfo(false)
      .publicPath("")
      .libraryTarget("commonjs")
      .globalObject("global")
      .set("clean", true);
    // Set up Terser options
    config.optimization.minimizer("TerserPlugin").use(TerserPlugin, [
      {
        terserOptions: {
          compress: {
            collapse_vars: false,
            sequences: false,
            keep_infinity: true,
            drop_console: mode === "production",
            global_defs: {
              __UGLIFIED__: true,
            },
          },
          keep_fnames: true,
          keep_classnames: true,
        },
      },
    ]);
    config.resolve.extensions.add(`.${platform}.ts`).add(".ts");
    // resolve symlinks
    config.resolve.symlinks(true);
    // resolve modules in project node_modules first
    // then fall-back to default node resolution (up the parent folder chain)
    config.resolve.modules
      .add(resolve(projectDir, `node_modules/@nativescript/core`))
      .add(resolve(projectDir, `node_modules`))
      .add("node_modules");
    // set up ts support
    config.module
      .rule("ts")
      .test([/\.ts$/])
      .use("ts-loader")
      .loader("ts-loader")
      .options({
        // todo: perhaps we can provide a default tsconfig
        // and use that if the project doesn't have one?
        configFile: tsConfigPath,
        transpileOnly: true,
        allowTsInNodeModules: true,
        compilerOptions: {
          sourceMap: false,
          declaration: false,
        },
        getCustomTransformers() {
          return {
            before: [require("@nativescript/webpack/dist/transformers/NativeClass").default],
          };
        },
      });
  });
  return webpack.resolveConfig();
};