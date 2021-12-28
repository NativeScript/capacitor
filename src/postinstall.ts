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
const xcodeProjName = 'ios/App/App.xcodeproj/project.pbxproj';

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
    fse.copySync(
      './src/nativescript',
      path.join(rootPath, projectManagedNsPath),
    );
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
          'dev:nativescript': `dev-nativescript`
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
            const capacitorConfigJson = JSON.parse(
              stripJsonComments(capacitorConfigContent),
            );
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
              const nsTsConfigJson = JSON.parse(
                stripJsonComments(nsTsConfigContent),
              );
              if (
                nsTsConfigJson &&
                nsTsConfigJson.compilerOptions &&
                nsTsConfigJson.compilerOptions.outDir
              ) {
                nsTsConfigJson.compilerOptions.outDir = `../../${buildFolder}/nativescript`;
              }
              fs.writeFileSync(
                nsTsConfigPath,
                `${JSON.stringify(nsTsConfigJson, null, 2)}\n`,
              );
            }
          }
        }

        if (updatedPackage) {
          fs.writeFileSync(
            packagePath,
            `${JSON.stringify(packageJson, null, 2)}\n`,
          );
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
      const tsConfigJson = JSON.parse(stripJsonComments(tsConfigContent));
      if (tsConfigJson) {
        if (!tsConfigJson.exclude) {
          tsConfigJson.exclude = [];
        }
        if (!tsConfigJson.exclude.includes('src/nativescript')) {
          tsConfigJson.exclude.push('src/nativescript');
          fs.writeFileSync(
            tsConfigPath,
            `${JSON.stringify(tsConfigJson, null, 2)}\n`,
          );
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
    fse.copySync(
      './bridge/native-custom.d.ts',
      path.join(rootPath, projectManagedCustomNativePath),
    );
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
  const appDelegateFileName = 'ios/App/App/AppDelegate.swift';
  const xcodeProjName = 'ios/App/App.xcodeproj/project.pbxproj';
  const xcode = require('nativescript-dev-xcode'),
    projectPath = path.join(rootPath, xcodeProjName),
    appDelegatePath = path.join(rootPath, appDelegateFileName);
  // console.log('projectPath:', path.resolve(projectPath));

  return new Promise(resolve => {
    const hasCapacitorConfigJson = fs.existsSync(capacitorConfigPath);
    const hasCapacitorConfigTS = fs.existsSync(capacitorConfigTSPath);
    if (hasCapacitorConfigJson || hasCapacitorConfigTS) {
      if (fse.existsSync(projectPath)) {
        fs.createReadStream('./embed/ios/NSFrameworks/Frameworks.zip')
          .pipe(unzipper.Extract({ path: 'embed/ios/NSFrameworks' }))
          .on('finish', res => {
            // check if already embedded
            const appDelegateContent = fs.readFileSync(appDelegatePath, {
              encoding: 'UTF-8',
            });
            if (
              appDelegateContent &&
              appDelegateContent.indexOf('TNSRuntime.init') === -1
            ) {
              // update delegate
              // console.log("Updating AppDelegate from:");
              // console.log(path.resolve(appDelegatePath));
              if (appDelegateContent) {
                const winVar = 'window: UIWindow?';
                const uiWinIndex = appDelegateContent.indexOf(winVar);
                const modifyPart1 = appDelegateContent.split('');
                // add runtime var
                modifyPart1.splice(
                  uiWinIndex + winVar.length + 1,
                  0,
                  `    var runtime: TNSRuntime?\n`,
                );
                let updatedDelegate = modifyPart1.join('');
                const didFinishLaunch = `UIApplication.LaunchOptionsKey: Any]?) -> Bool {`;
                const didFinishLaunchIndex = updatedDelegate.indexOf(
                  didFinishLaunch,
                );
                const modifyPart2 = updatedDelegate.split('');
                // add runtime init
                modifyPart2.splice(
                  didFinishLaunchIndex + didFinishLaunch.length + 1,
                  0,
                  `        // NativeScript init
                let pointer = runtimeMeta()
                TNSRuntime.initializeMetadata(pointer)
                self.runtime = TNSRuntime.init(applicationPath: Bundle.main.bundlePath)
                self.runtime?.executeModule("../public/nativescript/index.js")\n`,
                );
                updatedDelegate = modifyPart2.join('');
                // save updates
                fs.writeFileSync(appDelegatePath, updatedDelegate);
                console.log('UPDATED:', appDelegateFileName);
              }
            }

            // XCode embedding
            const xcProj = xcode.project(projectPath);

            // console.log('rootPath:', path.resolve(rootPath));

            // console.log("Looking for xcode project at ", path.resolve(path.join(rootPath, 'ios/App/')));

            xcProj.parse(function (err) {
              //copy frameworks
              fse.copySync(
                './embed/ios/NSFrameworks/Frameworks/TNSWidgets.xcframework',
                path.join(rootPath, 'ios/App/TNSWidgets.xcframework'),
              );
              fse.copySync(
                './embed/ios/NSFrameworks/Frameworks/NativeScript.xcframework',
                path.join(rootPath, 'ios/App/NativeScript.xcframework'),
              );
              fse.copySync(
                './embed/ios/internal',
                path.join(rootPath, 'ios/App/internal'),
              );
              fse.copySync(
                './embed/ios/NativeScript',
                path.join(rootPath, 'ios/App/NativeScript'),
              );

              //  add runtime files
              const group = getRootGroup(
                'NativeScript',
                path.join(rootPath, 'ios/App/NativeScript'),
              );
              // console.log(group)
              xcProj.addPbxGroup(group.files, group.name, group.path, null, {
                isMain: true,
                filesRelativeToProject: true,
              });

              let hasPreBuild = false;
              let hasPreLink = false;
              let hasPostBuild = false;
              let hasEmbedFrameworks = false;

              //  check for each build phase
              let nativeTargetSection = xcProj.pbxNativeTargetSection();
              for (const key in nativeTargetSection) {
                if (Object.hasOwnProperty.call(nativeTargetSection, key)) {
                  const el = nativeTargetSection[key];
                  if (el.buildPhases) {
                    let newBuildPhases = el.buildPhases;
                    for (let i = 0; i < el.buildPhases.length; i++) {
                      const phase = el.buildPhases[i];
                      if (phase.comment === 'PreBuild') {
                        hasPreBuild = true;
                      }

                      if (phase.comment === 'PreLink') {
                        hasPreLink = true;
                      }

                      if (phase.comment === 'PostBuild') {
                        hasPostBuild = true;
                      }

                      if (phase.comment === 'Embed Frameworks') {
                        hasEmbedFrameworks = true;
                      }
                    }
                    el.buildPhases = newBuildPhases;
                  }
                }
              }

              // add non-existing build phases
              if (!hasPreBuild) {
                addPreBuild(xcProj);
              }

              if (!hasPreLink) {
                addPreLink(xcProj);
              }

              // if (!hasPostBuild) {
              //     addPostBuild(xcProj);
              // }

              if (!hasEmbedFrameworks) {
                addEmbedFrameworks(xcProj);
              }

              //  sort build phases
              for (const key in nativeTargetSection) {
                if (Object.hasOwnProperty.call(nativeTargetSection, key)) {
                  const el = nativeTargetSection[key];
                  if (el.buildPhases) {
                    let newBuildPhases = new Array(8); // TODO: dont forget to update this
                    for (let i = 0; i < el.buildPhases.length; i++) {
                      const phase = el.buildPhases[i];
                      if (phase.comment === '[CP] Check Pods Manifest.lock') {
                        newBuildPhases[0] = phase;
                      }

                      if (phase.comment === 'PreBuild') {
                        newBuildPhases[1] = phase;
                      }

                      if (phase.comment === 'Sources') {
                        newBuildPhases[2] = phase;
                      }

                      if (phase.comment === 'PreLink') {
                        newBuildPhases[3] = phase;
                      }

                      if (phase.comment === 'Frameworks') {
                        newBuildPhases[4] = phase;
                      }

                      if (phase.comment === 'Resources') {
                        newBuildPhases[5] = phase;
                      }

                      if (phase.comment === '[CP] Embed Pods Frameworks') {
                        newBuildPhases[6] = phase;
                      }

                      if (phase.comment === 'Embed Frameworks') {
                        newBuildPhases[7] = phase;
                      }

                      // if (phase.comment === "PostBuild") {
                      //     newBuildPhases[9] = phase;
                      // }
                    }
                    el.buildPhases = newBuildPhases;
                  }
                }
              }

              // add frameworks
              const nsframeworkRelativePath = 'NativeScript.xcframework';
              xcProj.addFramework(nsframeworkRelativePath, {
                embed: true,
                sign: true,
                customFramework: true,
                target: xcProj.getFirstTarget().uuid,
              });

              const tnswidgetsRelativePath = 'TNSWidgets.xcframework';
              xcProj.addFramework(tnswidgetsRelativePath, {
                embed: true,
                sign: true,
                customFramework: true,
                target: xcProj.getFirstTarget().uuid,
              });

              xcProj.addToHeaderSearchPaths('$(SRCROOT)/NativeScript');

              xcProj.addToBuildSettings(
                'SWIFT_OBJC_BRIDGING_HEADER',
                '"$(SRCROOT)/NativeScript/App-Bridging-Header.h"',
              );

              xcProj.addToBuildSettings(
                'OTHER_LDFLAGS',
                '(\r\n\t\t\t\t\t"$(inherited)",\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\t"\\"Capacitor\\"",\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\t"\\"Cordova\\"",\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\t"\\"WebKit\\"",\r\n\t\t\t\t\t"$(inherited)",\r\n\t\t\t\t\t"-ObjC",\r\n\t\t\t\t\t"-sectcreate",\r\n\t\t\t\t\t__DATA,\r\n\t\t\t\t\t__TNSMetadata,\r\n\t\t\t\t\t"\\"$(CONFIGURATION_BUILD_DIR)/metadata-$(CURRENT_ARCH).bin\\"",\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\tNativeScript,\r\n\t\t\t\t\t"-F\\"$(SRCROOT)/internal\\"",\r\n\t\t\t\t\t"-licucore",\r\n\t\t\t\t\t"-lz",\r\n\t\t\t\t\t"-lc++",\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\tFoundation,\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\tUIKit,\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\tCoreGraphics,\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\tMobileCoreServices,\r\n\t\t\t\t\t"-framework",\r\n\t\t\t\t\tSecurity,\r\n\t\t\t\t)',
              );
              xcProj.addToBuildSettings('LD', '"$SRCROOT/internal/nsld.sh"');
              xcProj.addToBuildSettings(
                'LDPLUSPLUS',
                '"$SRCROOT/internal/nsld.sh"',
              );
              xcProj.addToBuildSettings('ENABLE_BITCODE', 'NO');
              xcProj.addToBuildSettings('CLANG_ENABLE_MODULES', 'NO');

              fs.writeFileSync(projectPath, xcProj.writeSync());

              resolve();
            });

            function addPreBuild(proj) {
              proj.addBuildPhase(
                [],
                'PBXShellScriptBuildPhase',
                'PreBuild',
                null,
                {
                  shellPath: '/bin/sh',
                  shellScript: '"${SRCROOT}/internal/nativescript-pre-build"',
                },
              );
            }

            function addPreLink(proj) {
              proj.addBuildPhase(
                [],
                'PBXShellScriptBuildPhase',
                'PreLink',
                null,
                {
                  shellPath: '/bin/sh',
                  shellScript: '"${SRCROOT}/internal/nativescript-pre-link"',
                },
              );
            }

            function addPostBuild(proj) {
              proj.addBuildPhase(
                [],
                'PBXShellScriptBuildPhase',
                'PostBuild',
                null,
                {
                  shellPath: '/bin/sh',
                  shellScript: '"${SRCROOT}/internal/nativescript-post-build"',
                },
              );
            }

            function addEmbedFrameworks(proj) {
              //needed for embed&sign
              proj.addBuildPhase(
                [],
                'PBXCopyFilesBuildPhase',
                'Embed Frameworks',
                null,
                'frameworks',
              );
            }

            function getRootGroup(name, rootPath) {
              const filePathsArr = [];
              const rootGroup = {
                name: name,
                files: filePathsArr,
                path: rootPath,
              };

              if (fs.existsSync(rootPath)) {
                fs.readdirSync(rootPath).forEach(fileName => {
                  const filePath = path.join(rootGroup.path, fileName);
                  filePathsArr.push(filePath);
                });
              }

              return rootGroup;
            }
          })
          .on('error', res => {
            console.log(
              `ERROR: An error occurred while installing @nativescript/capacitor. You may try again.\n\n`,
            );
            resolve();
          });
      } else {
        console.error(
          'ERROR: @nativescript/capacitor requires a Capacitor iOS target to be initialized. Be sure you have "npx cap add ios" in this project before installing.\n\n',
        );
        resolve();
      }
    } else {
      console.error(
        'ERROR: @nativescript/capacitor requires a Capacitor project. Ensure you have "npx cap init" in this project before installing.\n\n',
      );
      resolve();
    }
  });
}

function uninstallIOS(): Promise<void> {
  return new Promise(resolve => {
    const appDelegateFileName = 'ios/App/App/AppDelegate.swift';
    const xcodeProjName = 'ios/App/App.xcodeproj/project.pbxproj';
    const xcode = require('nativescript-dev-xcode'),
      projectPath = path.join(rootPath, xcodeProjName),
      appDelegatePath = path.join(rootPath, appDelegateFileName);

    const appDelegateContent = fs.readFileSync(appDelegatePath, {
      encoding: 'UTF-8',
    });
    if (
      appDelegateContent &&
      appDelegateContent.indexOf('TNSRuntime.init') > -1
    ) {
      let updatedDelegate = appDelegateContent.replace(
        'var runtime: TNSRuntime?',
        '',
      );
      updatedDelegate = updatedDelegate.replace('// NativeScript init', '');
      updatedDelegate = updatedDelegate.replace(
        'let pointer = runtimeMeta()',
        '',
      );
      updatedDelegate = updatedDelegate.replace(
        'TNSRuntime.initializeMetadata(pointer)',
        '',
      );
      updatedDelegate = updatedDelegate.replace(
        'self.runtime = TNSRuntime.init(applicationPath: Bundle.main.bundlePath)',
        '',
      );
      updatedDelegate = updatedDelegate.replace(
        'self.runtime?.executeModule("../public/nativescript/index.js")',
        '',
      );

      fs.writeFileSync(appDelegatePath, updatedDelegate);
      console.log('UPDATED:', appDelegateFileName);
    }

    const xcProj = xcode.project(projectPath);

    xcProj.parse(function (err) {

      deleteFolderRecursive(path.join(rootPath, 'ios/App/TNSWidgets.xcframework'));
      deleteFolderRecursive(path.join(rootPath, 'ios/App/TNSWidgets.xcframework'));

      deleteFolderRecursive(path.join(rootPath, 'ios/App/internal'));
      deleteFolderRecursive(path.join(rootPath, 'ios/App/NativeScript'));
      xcProj.removePbxGroup('NativeScript');

      const phases = [
        'PreBuild',
        'PreLink',
        // 'PostBuild',
        'Embed Frameworks'
      ];

      //TODO: if the build phase has files with it we have to remove them as well
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        xcProj.removeBuildPhase(phase);
      }

      const nsframeworkRelativePath = 'NativeScript.xcframework';
      xcProj.removeFramework(nsframeworkRelativePath);
      const tnswidgetsRelativePath = 'TNSWidgets.xcframework';
      xcProj.removeFramework(tnswidgetsRelativePath);
      // xcProj.removeFromHeaderSearchPaths('$(SRCROOT)/NativeScript')
      xcProj.removeFromBuildSettings('SWIFT_OBJC_BRIDGING_HEADER');
      xcProj.removeFromBuildSettings('OTHER_LDFLAGS');
      xcProj.removeFromBuildSettings('LD');
      xcProj.removeFromBuildSettings('LDPLUSPLUS');
      xcProj.addToBuildSettings('ENABLE_BITCODE', 'YES');
      xcProj.addToBuildSettings('CLANG_ENABLE_MODULES', 'YES');

      fs.writeFileSync(projectPath, xcProj.writeSync());
      resolve();

    });

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
  return new Promise(resolve => {
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

    fse.copySync(
      './embed/android/app-gradle-helpers',
      path.join(rootPath, 'android/app/gradle-helpers'),
    );
    fse.copySync(
      './embed/android/build-tools',
      path.join(rootPath, 'android/build-tools'),
    );
    fse.copySync(
      './embed/android/debug',
      path.join(rootPath, 'android/app/src/debug'),
    );
    fse.copySync(
      './embed/android/gradle-helpers',
      path.join(rootPath, 'android/app/gradle-helpers'),
    );
    fse.copySync(
      './embed/android/internal',
      path.join(rootPath, 'android/app/src/main/assets/internal'),
    );
    fse.copySync(
      './embed/android/libs',
      path.join(rootPath, 'android/app/libs'),
    );
    fse.copySync(
      './embed/android/main',
      path.join(rootPath, 'android/app/src/main'),
    );
    fse.copyFileSync(
      './embed/android/nativescript.build.gradle',
      path.join(rootPath, 'android/nativescript.build.gradle'),
    );
    fse.copyFileSync(
      './embed/android/nativescript.buildscript.gradle',
      path.join(rootPath, 'android/nativescript.buildscript.gradle'),
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

      if (
        projectGradleContent.indexOf(
          'org.jetbrains.kotlin:kotlin-gradle-plugin',
        ) === -1
      ) {
        const dependencies =
          'dependencies {\n' +
          'def computeKotlinVersion = { -> project.hasProperty("kotlinVersion") ? kotlinVersion : "1.4.21"}\n' +
          'def kotlinVersion = computeKotlinVersion()\n' +
          'classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion"\n';
        projectGradleContent = projectGradleContent.replace(
          /(dependencies(\s{)?({)?)/,
          dependencies,
        );
        fs.writeFileSync(projectGradlePath, projectGradleContent);
      }
      const apply = `\napply from: 'nativescript.buildscript.gradle'`;
      if (projectGradleContent.indexOf(apply) === -1) {
        projectGradleContent = projectGradleContent.replace(
          /(dependencies(\s{)?({)?)/,
          'dependencies {' + apply,
        );
        fs.writeFileSync(projectGradlePath, projectGradleContent);
      }
    }

    const mainAndroidManifestPath = path.join(
      rootPath,
      'android/app/src/main/AndroidManifest.xml',
    );
    const mainAndroidManifest = fs.readFileSync(mainAndroidManifestPath);
    if (mainAndroidManifest) {
      const mainAndroidManifestDocument: Document = parser.parseFromString(
        mainAndroidManifest.toString(),
      );
      const packageName = mainAndroidManifestDocument.documentElement.getAttribute(
        'package',
      );
      const applicationEl = mainAndroidManifestDocument.documentElement.getElementsByTagName(
        'application',
      )?.[0];

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
        fs.writeFileSync(
          mainAndroidManifestPath,
          serializer.serializeToString(mainAndroidManifestDocument),
        );
      } else {
        if (applicationName !== defaultApplicationName) {
          const applicationFile = path.join(
            rootPath,
            `android/app/src/main/java/${applicationName.replace(/\./g, '/')}`,
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
                exampleApplicationContent,
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
  return new Promise(resolve => {
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
    fse.removeSync(
      path.join(rootPath, 'android/app/src/debug/res/layout/error_activity.xml'),
    );
    fse.removeSync(
      path.join(rootPath, 'android/app/src/debug/res/layout/exception_tab.xml'),
    );
    fse.removeSync(
      path.join(rootPath, 'android/app/src/debug/res/layout/logcat_tab.xml'),
    );
    fse.removeSync(path.join(rootPath, 'android/app/gradle-helpers'));
    fse.removeSync(path.join(rootPath, 'android/app/src/main/assets/internal'));
    fse.removeSync(path.join(rootPath, 'android/app/src/main/assets/metadata'));
    fse.removeSync(
      path.join(rootPath, 'android/app/libs/nativescript-optimized.aar'),
    );
    fse.removeSync(
      path.join(
        rootPath,
        'android/app/libs/nativescript-optimized-with-inspector.aar',
      ),
    );
    fse.removeSync(
      path.join(rootPath, 'android/app/libs/nativescript-regular.aar'),
    );

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

    fse.removeSync(
      path.join(rootPath, 'android/nativescript.buildscript.gradle'),
    );

    const mainAndroidManifestPath = path.join(
      rootPath,
      'android/app/src/main/AndroidManifest.xml',
    );
    const mainAndroidManifest = fs.readFileSync(mainAndroidManifestPath);
    if (mainAndroidManifest) {
      const mainAndroidManifestDocument: Document = parser.parseFromString(
        mainAndroidManifest.toString(),
      );
      const packageName = mainAndroidManifestDocument.documentElement.getAttribute(
        'package',
      );
      const applicationEl = mainAndroidManifestDocument.documentElement.getElementsByTagName(
        'application',
      )?.[0];

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
        fs.writeFileSync(
          mainAndroidManifestPath,
          serializer.serializeToString(mainAndroidManifestDocument),
        );
      } else {
        const applicationFile = path.join(
          rootPath,
          `android/app/src/main/java/${applicationName.replace(/\./g, '/')}`,
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

        if (has === 3) {
          console.log(
            'To finish uninstalling \n Please use remove the following as a guide to clean up your custom Application Class\n' +
              removalExampleApplicationContent,
          );
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

const hasAndroidApp = fs.existsSync(
  path.join(rootPath, 'android/app/build.gradle'),
);
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
  child.on('error', error => {
    console.log('NativeScript install error:', error);
  });
  child.on('close', res => {
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

if (argv.action === 'uninstall') {
  if (hasIosApp) {
    uninstallIOS().then(() => {
      uninstallAndroid();
    })
  } else if (hasAndroidApp) {
    uninstallAndroid();
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
