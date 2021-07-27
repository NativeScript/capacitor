#!/usr/bin/env node
const chokidar = require('chokidar');
const { execSync } = require('child_process');
const prompts = require('prompts');
const path = require('path');
const fs = require('fs');

const projectDir = process.cwd();
const buildDir = path.resolve(
  projectDir,
  'src',
  'nativescript'
);
const platform = process.argv[2];


const getAvailableDevices = () => {
    if (platform !== 'ios' && platform !== 'android') {
        console.log("Please use valid platform (ios/android)")
        return;
    } 
    let devices = [];
    const iosRegex = /(iOS \d+)/g;
    const androidRegex = /(API \d+)/g;

    const result = execSync(`npx cap run ${platform} --list`).toString()
        .split('\n')
        .filter(line => line.match(platform === 'ios' ? iosRegex : androidRegex));

    result.forEach(device => {
        const id = device.split(" ").pop();
        devices.push({
            title: device,
            value: id
        })
    })
    return devices;
}

const selectTargetDevice = async (devicesAvailable) => {
    if (devicesAvailable) {
        targetDevice = await prompts({
            type: 'select',
            name: 'value',
            message: 'Please choose a target device',
            choices: devicesAvailable,
            initial: 0
        });
        return targetDevice.value;
    }
}

const buildApp = () => {
    execSync('npm run build:mobile', {stdio: 'inherit'});
}

const runOnTarget = (targetDevice) => {
    execSync(`npx cap run ${platform} --target ${targetDevice}`, {stdio: 'inherit'})
}

const watchFiles = (targetDevice) => {
    // ensureLocalDependenciesExists();
    buildApp()
    runOnTarget(targetDevice);
    console.log("Watching for file changes.");

    chokidar.watch(`${buildDir}/**/*.ts`, {
        interval: 100,
        binaryInterval: 300,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        },
    }).on('change', (event, path) => {
        console.log("File change detected.");
        buildApp()
        runOnTarget(targetDevice);
        console.log("Watching for file changes...");
    });
}
(async () => {

    let targetDevice = await selectTargetDevice(getAvailableDevices());
    if (targetDevice) {
        watchFiles(targetDevice);
    }
    
})();

