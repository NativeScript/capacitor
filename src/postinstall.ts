const rootPath = '../../../';
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { spawn } = require('child_process');
const yargs = require('yargs/yargs');
const stripJsonComments = require('strip-json-comments');
const unzipper = require('unzipper');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;
const capacitorConfigName = 'capacitor.config.json';
const capacitorConfigNameTS = 'capacitor.config.ts';
const capacitorConfigPath = path.join(rootPath, capacitorConfigName);
const capacitorConfigTSPath = path.join(rootPath, capacitorConfigNameTS);
const xcodeAppXcodeProjName = 'ios/App/App.xcodeproj';
const xcodeProjName = `${xcodeAppXcodeProjName}/project.pbxproj`;
const appDelegateFileName = 'ios/App/App/AppDelegate.swift';
const podfileName = 'ios/App/Podfile';

const podFilePostInstallStep = `nativescript_capacitor_post_install(installer)`;
const podFilePostInstall = `
post_install do |installer|
  ${podFilePostInstallStep}
end
            `;
const podFileNSPods = `\n pod 'NativeScript', '~> 8.3.3' \n pod 'NativeScriptUI'\n`;
const requireNSCode = `require_relative '../../node_modules/@nativescript/capacitor/ios/nativescript.rb'\n`;

// TODO: allow to be installed in {N} projects as well when using CapacitorView
// const nativeScriptConfig = 'nativescript.config.ts';

function addProjectManagedNativeScript() {
  console.log('⚙️   @nativescript/capacitor installing...');
  /**
   * Project managed NativeScript with examples
   */
  const projectManagedNsPath = 'src/nativescript';
  const projectManagedNsIndex = `${projectManagedNsPath}/index.ts`;
  if (!fse.existsSync(path.join(rootPath, projectManagedNsIndex))) {
    fse.ensureDirSync(path.join(rootPath, projectManagedNsPath));
    fse.copySync('./src/nativescript', path.join(rootPath, projectManagedNsPath));
    console.log('ADDED:', projectManagedNsPath);
  }

  /**
   * Frontend framework detection
   */
  let isAngular = false;
  let isReact = false;
  let isVue = false;
  const packageFileName = 'package.json';
  const packagePath = path.join(rootPath, packageFileName);
  if (fs.existsSync(packagePath)) {
    const packageContent = fs.readFileSync(packagePath, {
      encoding: 'UTF-8',
    });
    if (packageContent) {
      let updatedPackage = false;
      const packageJson = JSON.parse(stripJsonComments(packageContent));
      if (packageJson) {
        if (packageJson.dependencies['@angular/core']) {
          isAngular = true;
        } else if (packageJson.dependencies['react']) {
          isReact = true;
        } else if (packageJson.dependencies['vue']) {
          isVue = true;
        }
        // scripts for all
        const scriptsToAdd = {
          'build:nativescript': `build-nativescript`,
          'build:mobile': `npm-run-all build build:nativescript`,
          'dev:nativescript': `dev-nativescript`,
        };
        for (const key in scriptsToAdd) {
          if (packageJson.scripts && !packageJson.scripts[key]) {
            updatedPackage = true;
            packageJson.scripts[key] = scriptsToAdd[key];
          }
        }

        // scripts for frameworks
        // Determine configured build folder name
        let buildFolder = 'www';
        if (fs.existsSync(capacitorConfigPath)) {
          const capacitorConfigContent = fs.readFileSync(capacitorConfigPath, {
            encoding: 'UTF-8',
          });
          if (capacitorConfigContent) {
            const capacitorConfigJson = JSON.parse(stripJsonComments(capacitorConfigContent));
            if (capacitorConfigJson && capacitorConfigJson.webDir) {
              buildFolder = capacitorConfigJson.webDir;
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
              buildFolder = capacitorConfigTSContent.split(/webDir:\s*["'`](\w+)["'`]/gim)[1];
            }
          }
        }
        // defaults to www so only if different do we need to update
        if (buildFolder !== 'www') {
          // update the "Project managed NativeScript" tsconfig to output here
          const nsTsConfigName = 'src/nativescript/tsconfig.json';
          const nsTsConfigPath = path.join(rootPath, nsTsConfigName);
          if (fs.existsSync(nsTsConfigPath)) {
            const nsTsConfigContent = fs.readFileSync(nsTsConfigPath, {
              encoding: 'UTF-8',
            });
            if (nsTsConfigContent) {
              let nsTsConfigJson: any;
              try {
                nsTsConfigJson = JSON.parse(stripJsonComments(nsTsConfigContent));
              } catch (err) {
                // fallback as above can cause issues on some setups
                nsTsConfigJson = require('typescript').parseConfigFileTextToJson('tsconfig.json', nsTsConfigContent).config;
              }
              if (nsTsConfigJson && nsTsConfigJson.compilerOptions && nsTsConfigJson.compilerOptions.outDir) {
                nsTsConfigJson.compilerOptions.outDir = `../../${buildFolder}/nativescript`;
              }
              fs.writeFileSync(nsTsConfigPath, `${JSON.stringify(nsTsConfigJson, null, 2)}\n`);
            }
          }
        }

        if (updatedPackage) {
          fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
          console.log('UPDATED:', 'package.json');
        }
      }
    }
  }

  // update tsconfig excludes
  const tsConfigFileName = 'tsconfig.json';
  const tsConfigPath = path.join(rootPath, tsConfigFileName);
  if (fs.existsSync(tsConfigPath)) {
    const tsConfigContent = fs.readFileSync(tsConfigPath, {
      encoding: 'UTF-8',
    });
    if (tsConfigContent) {
      let tsConfigJson: any;
      try {
        tsConfigJson = JSON.parse(stripJsonComments(tsConfigContent));
      } catch (err) {
        // fallback as above can cause issues on some setups
        tsConfigJson = require('typescript').parseConfigFileTextToJson('tsconfig.json', tsConfigContent).config;
      }
      if (tsConfigJson) {
        if (!tsConfigJson.exclude) {
          tsConfigJson.exclude = [];
        }
        if (!tsConfigJson.exclude.includes('src/nativescript')) {
          tsConfigJson.exclude.push('src/nativescript');
          fs.writeFileSync(tsConfigPath, `${JSON.stringify(tsConfigJson, null, 2)}\n`);
        }
      }
    }
  }
}

function addProjectManagedCustomNativeAPI() {
  /**
   * Project managed custom native api
   */
  const projectManagedCustomNativePath = 'src/native-custom.d.ts';
  if (!fse.existsSync(path.join(rootPath, projectManagedCustomNativePath))) {
    fse.copySync('./bridge/native-custom.d.ts', path.join(rootPath, projectManagedCustomNativePath));
    console.log('ADDED:', projectManagedCustomNativePath);
  }
}

function addGitIgnoreRules() {
  const gitIgnoreFileName = '.gitignore';
  const gitIgnorePath = path.join(rootPath, gitIgnoreFileName);
  if (fs.existsSync(gitIgnorePath)) {
    let gitIgnoreContent = fs.readFileSync(gitIgnorePath, {
      encoding: 'UTF-8',
    });
    if (gitIgnoreContent && gitIgnoreContent.indexOf('# NativeScript') === -1) {
      gitIgnoreContent =
        gitIgnoreContent +
        `\n
# NativeScript
android/app/gradle-helpers
android/app/src/debug/java/com/tns
android/app/src/debug/res/layout/error_activity.xml
android/app/src/debug/res/layout/exception_tab.xml
android/app/src/debug/res/layout/logcat_tab.xml
android/app/src/main/assets/internal
android/app/src/main/assets/metadata
android/app/src/main/java/com/tns
android/build-tools
ios/App/internal
ios/App/NativeScript*
ios/App/TNSWidgets*
ios/App/.build*
src/nativescript/node_modules
src/nativescript/package-lock.json
      `;
      fs.writeFileSync(gitIgnorePath, gitIgnoreContent);
      console.log('UPDATED:', gitIgnoreFileName);
    }
  }
}
/**
 * IOS EMBED
 */
function installIOS(): Promise<void> {
  const xcode = require('nativescript-dev-xcode'),
    projectPath = path.join(rootPath, xcodeProjName),
    podfilePath = path.join(rootPath, podfileName),
    appDelegatePath = path.join(rootPath, appDelegateFileName);
  // console.log('projectPath:', path.resolve(projectPath));

  return new Promise((resolve) => {
    const hasCapacitorConfigJson = fs.existsSync(capacitorConfigPath);
    const hasCapacitorConfigTS = fs.existsSync(capacitorConfigTSPath);
    if (hasCapacitorConfigJson || hasCapacitorConfigTS) {
      console.log('Checking for Podfile...');
      if (fse.existsSync(podfilePath)) {
        const podfileContent = fs.readFileSync(podfilePath, {
          encoding: 'UTF-8',
        });

        if (podfileContent && podfileContent.indexOf("pod 'NativeScript'") === -1) {
          if (podfileContent) {
            const podsComment = 'Add your Pods here';
            const podsCommentIndex = podfileContent.indexOf(podsComment);
            let modifyPartPods: Array<string> = podfileContent.split('');
            modifyPartPods.splice(podsCommentIndex + podsComment.length + 1, 0, podFileNSPods);
            let updatedPodfile: string = modifyPartPods.join('');

            const assertDeploymentPostInstall = 'assertDeploymentTarget(installer)';
            const assertDeploymentPostInstallIndex = updatedPodfile.indexOf(assertDeploymentPostInstall);
            if (assertDeploymentPostInstallIndex > -1) {
              modifyPartPods = updatedPodfile.split('');
              modifyPartPods.splice(assertDeploymentPostInstallIndex + assertDeploymentPostInstall.length + 1, 0, `\n  ${podFilePostInstallStep}\n`);
              updatedPodfile = modifyPartPods.join('');

              updatedPodfile = requireNSCode + updatedPodfile;
            } else {
              updatedPodfile = requireNSCode + updatedPodfile + podFilePostInstall;
            }

            fs.writeFileSync(podfilePath, updatedPodfile);
            console.log('UPDATED:', podfilePath);
          }
        }
      } else {
        console.log("Podfile doesn't exist");
      }

      if (fse.existsSync(projectPath)) {
        // check if already embedded
        const appDelegateContent = fs.readFileSync(appDelegatePath, {
          encoding: 'UTF-8',
        });
        if (appDelegateContent && appDelegateContent.indexOf('NativeScript.init') === -1) {
          // update delegate
          // console.log("Updating AppDelegate from:");
          // console.log(path.resolve(appDelegatePath));

          const winVar = 'window: UIWindow?';
          const uiWinIndex = appDelegateContent.indexOf(winVar);
          const modifyPart1 = appDelegateContent.split('');
          // add runtime var
          modifyPart1.splice(uiWinIndex + winVar.length + 1, 0, `    var nativescript: NativeScript?\n`);
          let updatedDelegate = modifyPart1.join('');
          const didFinishLaunch = `UIApplication.LaunchOptionsKey: Any]?) -> Bool {`;
          const didFinishLaunchIndex = updatedDelegate.indexOf(didFinishLaunch);
          const modifyPart2 = updatedDelegate.split('');
          // add runtime init
          modifyPart2.splice(
            didFinishLaunchIndex + didFinishLaunch.length + 1,
            0,
            `        // NativeScript init
        let nsConfig = Config.init()
        nsConfig.metadataPtr = runtimeMeta()
        // can turn off in production
        nsConfig.isDebug = true
        nsConfig.logToSystemConsole = nsConfig.isDebug
        nsConfig.baseDir = URL(string: "public", relativeTo: Bundle.main.resourceURL)?.path
        nsConfig.applicationPath = "nativescript"
        self.nativescript = NativeScript.init(config: nsConfig)\n
        self.nativescript?.runMainApplication()\n`
          );
          updatedDelegate = modifyPart2.join('');
          // save updates
          fs.writeFileSync(appDelegatePath, updatedDelegate);
          console.log('UPDATED:', appDelegateFileName);
          resolve();
        } else {
          resolve();
        }
      } else {
        console.error(
          'ERROR: @nativescript/capacitor requires a Capacitor iOS target to be initialized. Be sure you have "npx cap add ios" in this project before installing.\n\n'
        );
        resolve();
      }
    } else {
      console.error(
        'ERROR: @nativescript/capacitor requires a Capacitor project. Ensure you have "npx cap init" in this project before installing.\n\n'
      );
      resolve();
    }
  });
}

/**
 * ANDROID EMBED
 */
const defaultApplicationName = 'com.tns.NativeScriptApplication';
const xmldom = require('xmldom');
const parser = new xmldom.DOMParser();
const serializer = new xmldom.XMLSerializer();
function installAndroid(): Promise<void> {
  return new Promise((resolve) => {
    const exampleApplicationContent = `
    package my.capacitor.app;

    import android.app.Application;
    import com.tns.Runtime;
    import com.tns.RuntimeHelper;
    import java.io.File;

    public class MyCapacitorApplication extends Application {
        Runtime rt;
        private static MyCapacitorApplication thiz;

        public MyCapacitorApplication() {
            thiz = this;
        }

        public void onCreate() {
            super.onCreate();
            rt = RuntimeHelper.initRuntime(this);
            if(rt != null){
              File file = new File(getFilesDir(), "public/nativescript.js");
              rt.runScript(file);
            }
        }

        public static Application getInstance() {
            return thiz;
        }
    }`;

    fse.copySync('./embed/android/app-gradle-helpers', path.join(rootPath, 'android/app/gradle-helpers'));
    fse.copySync('./embed/android/build-tools', path.join(rootPath, 'android/build-tools'));
    fse.copySync('./embed/android/debug', path.join(rootPath, 'android/app/src/debug'));
    fse.copySync('./embed/android/gradle-helpers', path.join(rootPath, 'android/app/gradle-helpers'));
    fse.copySync('./embed/android/internal', path.join(rootPath, 'android/app/src/main/assets/internal'));
    fse.copySync('./embed/android/libs', path.join(rootPath, 'android/app/libs'));
    fse.copySync('./embed/android/main', path.join(rootPath, 'android/app/src/main'));
    fse.copyFileSync(
      './embed/android/nativescript.build.gradle',
      path.join(rootPath, 'android/nativescript.build.gradle')
    );
    fse.copyFileSync(
      './embed/android/nativescript.buildscript.gradle',
      path.join(rootPath, 'android/nativescript.buildscript.gradle')
    );

    const appGradlePath = path.join(rootPath, 'android/app/build.gradle');

    const appGradle = fs.readFileSync(appGradlePath);
    if (appGradle) {
      let appGradleContent = appGradle.toString();
      const apply = `\napply from: '../nativescript.build.gradle'`;
      if (appGradleContent.indexOf(apply) === -1) {
        appGradleContent = appGradleContent + apply;
        fs.writeFileSync(appGradlePath, appGradleContent);
      }
    }

    const projectGradlePath = path.join(rootPath, 'android/build.gradle');
    const projectGradle = fs.readFileSync(projectGradlePath);
    if (projectGradle) {
      let projectGradleContent = projectGradle.toString();

      if (projectGradleContent.indexOf('org.jetbrains.kotlin:kotlin-gradle-plugin') === -1) {
        const dependencies =
          'dependencies {\n' +
          'def computeKotlinVersion = { -> project.hasProperty("kotlinVersion") ? kotlinVersion : "1.4.21"}\n' +
          'def kotlinVersion = computeKotlinVersion()\n' +
          'classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion"\n';
        projectGradleContent = projectGradleContent.replace(/(dependencies(\s{)?({)?)/, dependencies);
        fs.writeFileSync(projectGradlePath, projectGradleContent);
      }
      const apply = `\napply from: 'nativescript.buildscript.gradle'`;
      if (projectGradleContent.indexOf(apply) === -1) {
        projectGradleContent = projectGradleContent.replace(/(dependencies(\s{)?({)?)/, 'dependencies {' + apply);
        fs.writeFileSync(projectGradlePath, projectGradleContent);
      }
    }

    const mainAndroidManifestPath = path.join(rootPath, 'android/app/src/main/AndroidManifest.xml');
    const mainAndroidManifest = fs.readFileSync(mainAndroidManifestPath);
    if (mainAndroidManifest) {
      const mainAndroidManifestDocument: Document = parser.parseFromString(mainAndroidManifest.toString());
      const packageName = mainAndroidManifestDocument.documentElement.getAttribute('package');
      const applicationEl = mainAndroidManifestDocument.documentElement.getElementsByTagName('application')?.[0];

      let applicationName: string;

      if (packageName && applicationEl) {
        if (typeof packageName === 'string' && packageName !== '') {
          const name = applicationEl.getAttribute('android:name');
          if (typeof name === 'string' && name.startsWith('.')) {
            applicationName = packageName + name;
          } else if (typeof name === 'string') {
            applicationName = name;
          }
        }
      } else if (applicationEl) {
        const name = applicationEl.getAttribute('android:name');
        if (typeof name === 'string' && !name.startsWith('.')) {
          applicationName = name;
        }
      }

      if (!applicationName) {
        applicationEl.setAttribute('android:name', defaultApplicationName);
        fs.writeFileSync(mainAndroidManifestPath, serializer.serializeToString(mainAndroidManifestDocument));
      } else {
        if (applicationName !== defaultApplicationName) {
          const applicationFile = path.join(
            rootPath,
            `android/app/src/main/java/${applicationName.replace(/\./g, '/')}`
          );
          const application = fs.readFileSync(applicationFile);
          const appContent = application.toString();
          let has = 0;
          if (appContent.indexOf('RuntimeHelper.initRuntime(this)') > -1) {
            has++;
          }

          if (appContent.indexOf('.runScript(') > -1) {
            has++;
          }

          if (appContent.indexOf('Application getInstance()') > -1) {
            has++;
          }

          if (has !== 3) {
            throw new Error(
              'Application Class is not configured to start the NativeScript Runtime \n Please use the following as a guide to configure your custom Application class \n ' +
                exampleApplicationContent
            );
          }
        }
      }
    }
    console.log('\n✅   Android Ready');
    resolve();
  });
}

function uninstallAndroid(): Promise<void> {
  return new Promise((resolve) => {
    const removalExampleApplicationContent = `
    package my.capacitor.app;

    import android.app.Application;
    import com.tns.Runtime; // remove this line
    import com.tns.RuntimeHelper; // remove this line
    import java.io.File; // remove this line if it's no longer used

    public class MyCapacitorApplication extends Application {
        Runtime rt; // remove this line
        private static MyCapacitorApplication thiz; // remove this line if it's no longer used

        public MyCapacitorApplication() {
            thiz = this;  // remove this line if it's no longer used
        }

        public void onCreate() {
            super.onCreate();
            rt = RuntimeHelper.initRuntime(this); // remove this line
            if(rt != null){ // remove this line
              File file = new File(getFilesDir(), "public/nativescript.js"); // remove this line
              rt.runScript(file); // remove this line
            }
        }

      // remove this line if it's no longer used
        public static Application getInstance() {
            return thiz;
        }
    }`;

    console.log('Cleaning up NativeScript Dependencies ...');
    fse.removeSync(path.join(rootPath, 'android/app/gradle-helpers'));
    fse.removeSync(path.join(rootPath, 'android/build-tools'));
    fse.removeSync(path.join(rootPath, 'android/app/src/main/java/com/tns'));
    fse.removeSync(path.join(rootPath, 'android/app/src/debug/java/com/tns'));
    fse.removeSync(path.join(rootPath, 'android/app/src/debug/res/layout/error_activity.xml'));
    fse.removeSync(path.join(rootPath, 'android/app/src/debug/res/layout/exception_tab.xml'));
    fse.removeSync(path.join(rootPath, 'android/app/src/debug/res/layout/logcat_tab.xml'));
    fse.removeSync(path.join(rootPath, 'android/app/gradle-helpers'));
    fse.removeSync(path.join(rootPath, 'android/app/src/main/assets/internal'));
    fse.removeSync(path.join(rootPath, 'android/app/src/main/assets/metadata'));
    fse.removeSync(path.join(rootPath, 'android/app/libs/nativescript-optimized.aar'));
    fse.removeSync(path.join(rootPath, 'android/app/libs/nativescript-optimized-with-inspector.aar'));
    fse.removeSync(path.join(rootPath, 'android/app/libs/nativescript-regular.aar'));

    const appGradlePath = path.join(rootPath, 'android/app/build.gradle');
    const appGradle = fs.readFileSync(appGradlePath);
    if (appGradle) {
      let appGradleContent = appGradle.toString();
      const apply = `\napply from: '../nativescript.build.gradle'`;
      if (appGradleContent.indexOf(apply) > -1) {
        appGradleContent = appGradleContent.replace(apply, '');
        fs.writeFileSync(appGradlePath, appGradleContent);
      }
    }

    const projectGradlePath = path.join(rootPath, 'android/build.gradle');
    const projectGradle = fs.readFileSync(projectGradlePath);
    if (projectGradle) {
      let projectGradleContent = projectGradle.toString();
      const apply = `\napply from: 'nativescript.buildscript.gradle'`;
      if (projectGradleContent.indexOf(apply) > -1) {
        projectGradleContent = projectGradleContent.replace(apply, '');
        fs.writeFileSync(projectGradlePath, projectGradleContent);
      }
    }

    fse.removeSync(path.join(rootPath, 'android/nativescript.build.gradle'));

    fse.removeSync(path.join(rootPath, 'android/nativescript.buildscript.gradle'));

    const mainAndroidManifestPath = path.join(rootPath, 'android/app/src/main/AndroidManifest.xml');
    const mainAndroidManifest = fs.readFileSync(mainAndroidManifestPath);
    if (mainAndroidManifest) {
      const mainAndroidManifestDocument: Document = parser.parseFromString(mainAndroidManifest.toString());
      const packageName = mainAndroidManifestDocument.documentElement.getAttribute('package');
      const applicationEl = mainAndroidManifestDocument.documentElement.getElementsByTagName('application')?.[0];

      let applicationName: string;

      if (packageName && applicationEl) {
        if (typeof packageName === 'string' && packageName !== '') {
          const name = applicationEl.getAttribute('android:name');
          if (typeof name === 'string' && name.startsWith('.')) {
            applicationName = packageName + name;
          } else if (typeof name === 'string') {
            applicationName = name;
          }
        }
      } else if (applicationEl) {
        const name = applicationEl.getAttribute('android:name');
        if (typeof name === 'string' && !name.startsWith('.')) {
          applicationName = name;
        }
      }

      if (applicationName === defaultApplicationName) {
        applicationEl.removeAttribute('android:name');
        fs.writeFileSync(mainAndroidManifestPath, serializer.serializeToString(mainAndroidManifestDocument));
      } else {
        try {
          const applicationFile = path.join(rootPath, `android/app/src/main/java/${applicationName.replace(/\./g, '/')}`);
          const application = fs.readFileSync(applicationFile);
          const appContent = application.toString();
          let has = 0;
          if (appContent.indexOf('RuntimeHelper.initRuntime(this)') > -1) {
            has++;
          }
  
          if (appContent.indexOf('.runScript(') > -1) {
            has++;
          }
  
          if (appContent.indexOf('Application getInstance()') > -1) {
            has++;
          }
  
          if (has === 3) {
            console.log(
              'To finish uninstalling \n Please use remove the following as a guide to clean up your custom Application Class\n' +
                removalExampleApplicationContent
            );
          }
        } catch (err) {
          console.log('NativeScript Android uninstall error:', err);
        }
      }
    }
    resolve();
  });
}

/**
 * POSTINSTALL INIT
 */

const hasIosApp = fs.existsSync(path.join(rootPath, xcodeProjName));
// console.log(
//   `path.join(rootPath, xcodeProjName):`,
//   path.resolve(path.join(rootPath, xcodeProjName)),
// );
// console.log('hasIosApp:', hasIosApp);

const hasAndroidApp = fs.existsSync(path.join(rootPath, 'android/app/build.gradle'));
// console.log(
//   `path.join(rootPath, 'android/app/build.gradle'):`,
//   path.resolve(path.join(rootPath, 'android/app/build.gradle')),
// );
// console.log('hasAndroidApp:', hasAndroidApp);

// const isNativeScriptApp = fs.existsSync(path.join(rootPath, nativeScriptConfig));
// console.log('isNativeScriptApp:', isNativeScriptApp);

const installDeps = () => {
  // Ensure dependencies are installed and ready to use
  const child = spawn(`./node_modules/.bin/build-nativescript`, ['install'], {
    cwd: path.resolve(rootPath),
    stdio: 'inherit',
    shell: true,
  });
  child.on('error', (error) => {
    console.log('NativeScript install error:', error);
  });
  child.on('close', (res) => {
    child.kill();
    console.log('⭐ @nativescript/capacitor ⭐');
    console.log('\n');
    console.log('🧠   Learn more:   👉   https://capacitor.nativescript.org/getting-started.html');
    console.log('\n');
  });
};

if (argv.action === 'install') {
  addProjectManagedNativeScript();
  addProjectManagedCustomNativeAPI();
  addGitIgnoreRules();

  if (hasIosApp) {
    installIOS().then(() => {
      console.log('\n✅   iOS Ready');
      if (hasAndroidApp) {
        installAndroid().then(() => {
          installDeps();
        });
      } else {
        installDeps();
      }
    });
  } else if (hasAndroidApp) {
    installAndroid().then(() => {
      installDeps();
    });
  } else {
    installDeps();
  }
}

const uninstallComplete = () => {
  console.log('@nativescript/capacitor successfully removed.');
  console.log('\n');
};
const uninstallError = (error) => {
  console.log('NativeScript uninstall error:', error);
};

if (argv.action === 'uninstall') {
  if (hasIosApp) {
    // invoke ruby script to remove from project
    const child = spawn(
      `ruby`,
      [
        './node_modules/@nativescript/capacitor/ios/nativescript.rb',
        'clean',
        path.resolve(path.join(rootPath, xcodeAppXcodeProjName)),
      ],
      {
        cwd: path.resolve(rootPath),
        stdio: 'inherit',
        shell: true,
      }
    );
    child.on('error', (error) => {
      uninstallError(error);
    });
    child.on('close', (res) => {
      child.kill();
      if (hasAndroidApp) {
        uninstallAndroid().then(
          () => {
            uninstallComplete();
          },
          (err) => {
            uninstallError(err);
          }
        );
      } else {
        uninstallComplete();
      }
    });
  } else if (hasAndroidApp) {
    uninstallAndroid().then(
      () => {
        uninstallComplete();
      },
      (err) => {
        uninstallError(err);
      }
    );
  }
}

const deleteFolderRecursive = function (directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
};
