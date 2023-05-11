import { join, relative, resolve, sep } from 'path';
import { spawn } from 'child_process';

const projectDir = process.cwd();
const cmdArgs = ['dist/esm/postinstall', `--action uninstall`];
// console.log('cmdArgs:', cmdArgs);
const child = spawn(`node`, cmdArgs, {
    cwd: resolve(join(projectDir, 'node_modules', '@nativescript', 'capacitor')),
    stdio: 'inherit',
    shell: true,
});
child.on('error', (error) => {
    console.log('NativeScript uninstall error:', error);
});
child.on('close', (res) => {
    console.log(`NativeScript uninstall complete.`);
    console.log(`\n`);
    console.log(`You can now 'npm uninstall @nativescript/capacitor'`);
    console.log(`\n`);
    child.kill();
});

export function init() {
  
}