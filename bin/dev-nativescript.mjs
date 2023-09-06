#!/usr/bin/env node
import chokidar from 'chokidar';
import { execSync } from 'child_process';
import prompts from 'prompts';
import path from 'path';

const projectDir = process.cwd();
const buildDir = path.resolve(projectDir, 'src', 'nativescript');

const platform = process.argv[2];
let targetDevice = process.argv[3] || null;

const printUsageInformation = () => {
  console.log('Usage: dev-native platform [target]\n');
  console.log('Arguments:');
  console.log('   platform          ios/android\n');
  console.log('Options:\n');
  console.log('   target            specific id of target device\n\n');
};

const getAvailableDevices = (platform) => {
  const iosRegex = /(iOS \d+)/g;
  const androidRegex = /(API \d+)/g;

  const result = execSync(`npx cap run ${platform} --list`)
    .toString()
    .split('\n')
    .filter((line) => line.match(platform === 'ios' ? iosRegex : androidRegex));

  return result.map((device) => {
    const id = device.split(' ').pop();
    return {
      title: device,
      value: id,
    };
  });
};

const selectTargetDevice = async (devicesAvailable) => {
  const targetDevice = await prompts({
    type: 'select',
    name: 'value',
    message: 'Please choose a target device',
    choices: devicesAvailable,
    initial: 0,
  });
  return targetDevice.value;
};

const buildApp = () => {
  execSync('npm run build:mobile', { stdio: 'inherit' });
};

const runOnTarget = (platform, targetDevice) => {
  execSync(`npx cap run ${platform} --target ${targetDevice}`, { stdio: 'inherit' });
};

const watchFiles = (platform, targetDevice) => {
  buildApp();
  runOnTarget(targetDevice);
  console.log('Watching for file changes...');

  chokidar
    .watch(`${buildDir}/**/*.ts`, {
      interval: 100,
      binaryInterval: 300,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    })
    .on('change', (_event, _path) => {
      console.log('File change detected.');
      buildApp();
      runOnTarget(platform, targetDevice);
      console.log('Watching for file changes...');
    });
};
(async () => {
  if (platform !== 'ios' && platform !== 'android') {
    printUsageInformation();
    console.log('Please use a valid platform (ios/android)');
    return;
  }

  if (!targetDevice) {
    const availableDevices = getAvailableDevices(platform);
    if (!availableDevices && availableDevices.length) {
      console.error('Error: no available devices found');
      return;
    }

    targetDevice = await selectTargetDevice(availableDevices);
  }

  if (targetDevice) {
    watchFiles(targetDevice);
  }
})();

export function init() {}
