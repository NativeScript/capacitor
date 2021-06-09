#!/usr/bin/env node
const { join, relative, resolve, sep } = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const stripJsonComments = require('strip-json-comments');

const [,, ...args] = process.argv;
// console.log('args:', args);
// console.log('process.cwd', process.cwd());
const installOnly = args && args[0] === 'install';
const projectDir = process.cwd();
const buildDir = join(
  projectDir,
  'src',
  'nativescript'
);
const capacitorConfigName = 'capacitor.config.json';
const capacitorConfigPath = join(projectDir, capacitorConfigName);
const capacitorConfigNameTS = 'capacitor.config.ts';
const capacitorConfigTSPath = join(projectDir, capacitorConfigNameTS);
let distFolder = 'www'; // default
let isReact = false;
let isVue = false;
let isAngular = false;
let webpackInfo;

const checkFramework = () => {
  // default is webpack5 config
  webpackInfo = {
    name: 'webpack.config.js',
    version: 5
  };

  // Note: Left here in case other flavor integrations end up using older webpack
  // const packagePath = join(projectDir, 'package.json');
  // const packageContent = fs.readFileSync(packagePath, {
  //   encoding: 'UTF-8',
  // });
  // if (packageContent) {
  //   const packageJson = JSON.parse(
  //     stripJsonComments(packageContent),
  //   );
  //   if (packageJson && packageJson.dependencies) {
  //     isReact = !!packageJson.dependencies['react'];
  //     isVue = !!packageJson.dependencies['vue'];
  //     if (isVue) {
  //       webpackInfo = {
  //         name: 'webpack4.config.js',
  //         version: 4
  //       };
  //     } else {
  //       isAngular = true;
  //     }
  //   }
  // }
};

const buildNativeScript = () => {
  // console.log('buildDir:', resolve(buildDir));
  
  // console.log('using webpack config:', webpackInfo.name);
  
  const configPath = require.resolve(`@nativescript/capacitor/bridge/${webpackInfo.name}`, {
    paths: [projectDir]
  });

  // webpack 5 needs at least one platform set
  if (webpackInfo.version === 5) {
    if (args && !args.find(a => a.indexOf('env=platform') > -1)) {
      // use ios by default when no platform argument is present
      // won't matter for most users since they will often use conditional logic
      // but for power users that start using .ios and .android files they can split npm scripts to pass either platform for further optimized builds
      args.push(`--env=platform=ios`);
    }
  }
  // console.log('configPath:', resolve(configPath));
  const cmdArgs = ['webpack', `--config=${resolve(configPath)}`, ...args];
  // console.log('cmdArgs:', cmdArgs);
  const child = spawn(`npx`, cmdArgs, {
    cwd: resolve(buildDir),
    stdio: 'inherit',
    shell: true,
  });
  child.on('error', (error) => {
    console.log('NativeScript build error:', error);
  });
  child.on('close', (res) => {
    console.log(`NativeScript build complete:`, `${distFolder}/nativescript/index.js`);
    child.kill();
  });
};

const installTsPatch = () => {
  // Ensure ts-patch is installed
  const child = spawn(`ts-patch`, ['install'], {
    cwd: resolve(buildDir),
    stdio: 'inherit',
    shell: true,
  });
  child.on('error', (error) => {
    console.log('NativeScript build error:', error);
  });
  child.on('close', (res) => {
    child.kill();
    if (!installOnly) {
      buildNativeScript();
    }
  });
}

const npmInstallTsPatch = () => {
  // Ensure ts-patch is installed
  const child = spawn(`npm`, ['install', '--legacy-peer-deps'], {
    cwd: resolve(buildDir),
    stdio: 'inherit',
    shell: true,
  });
  child.on('error', (error) => {
    console.log('NativeScript build error:', error);
  });
  child.on('close', (res) => {
    child.kill();
    installTsPatch();
  });
}

const npmInstall = () => {
  
  // Note: Left in case flavor integrations need any different dependencies in future
  // if (isReact) {
  //   // Exception case: React needs ts-loader ^6.2.2 installed
  //   const child = spawn(`npm`, ['install', 'ts-loader@6.2.2', '-D'], {
  //     cwd: resolve(buildDir),
  //     stdio: 'inherit',
  //     shell: true,
  //   });
  //   child.on('error', (error) => {
  //     console.log('NativeScript build error:', error);
  //   });
  //   child.on('close', (res) => {
  //     child.kill();
  //     installTsPatch();
  //   });
  // } else {
    // Vue projects bring in ts-loader 6.2.2 through vue cli dependencies
    // Angular project use webpack5 and can use the latest with @nativescript/webpack
    // proceed as normal
    npmInstallTsPatch();
  // }
}

if (!installOnly) {
  // Determine configured build folder name
  if (fs.existsSync(capacitorConfigPath)) {
    const capacitorConfigContent = fs.readFileSync(capacitorConfigPath, {
      encoding: 'UTF-8',
    });
    if (capacitorConfigContent) {
      const capacitorConfigJson = JSON.parse(
        stripJsonComments(capacitorConfigContent),
      );
      if (capacitorConfigJson && capacitorConfigJson.webDir) {
        distFolder = capacitorConfigJson.webDir;
      }
    }
  } else if (fs.existsSync(capacitorConfigTSPath)) {
    const capacitorConfigTSContent = fs.readFileSync(capacitorConfigTSPath, {
      encoding: 'UTF-8',
    });
    if (capacitorConfigTSContent) {
      // need a AST parser here - ridumentary check for now
      // assuming 3 likely values: www, build or dist
      if (capacitorConfigTSContent.indexOf(`webDir: 'www'`) === -1) {
        // not using default, parse it out
        distFolder = capacitorConfigTSContent.split(/webDir:\s*["'`](\w+)["'`]/gim)[1];
      }
    }
  } else {
    console.error(`NativeScript Build Error: could not find ${capacitorConfigName}`);
    return;
  }
  // defaults to www so only if different do we need to pass the argument
  if (distFolder !== 'www') {
    args.push(`--env=distFolder=${distFolder}`);
  }
}

// check frontend framework details
checkFramework();
// ensure various deps are installed and setup properly
npmInstall();