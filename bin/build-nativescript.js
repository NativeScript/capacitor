#!/usr/bin/env node
const { join, relative, resolve, sep } = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const stripJsonComments = require('strip-json-comments');

const [,, ...args] = process.argv;
// console.log('args:', args);
const installOnly = args && args[0] === 'install';
const projectDir = join(__dirname, '../../../../');
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

const buildNativeScript = () => {
  // console.log('buildDir:', resolve(buildDir));
  const configPath = join(
    projectDir,
    'node_modules',
    '@nativescript',
    'capacitor',
    'bridge',
    'webpack.config.js'
  );
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

const npmInstall = () => {
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
    args.push(`--env.distFolder=${distFolder}`);
  }
}

npmInstall();