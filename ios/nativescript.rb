
@command = ARGV[0]
@path = ARGV[1]

@internal_dest = nil

def addfiles (direc, current_group, main_target)
  Dir.glob(direc) do |item|
      next if item == '.' or item == '.DS_Store'

              if File.directory?(item)
          new_folder = File.basename(item)
          created_group = current_group.new_group(new_folder)
          addfiles("#{item}/*", created_group, main_target)
      else 
        i = current_group.new_file(item)
        if item.include? ".m"
            main_target.add_file_references([i])
        end
      end
  end
end


def nativescript_post_install(installer)
  
    save_current_state(installer)
    
    pods_path = File.expand_path("..", installer.pods_project.path)
    internal_path = pods_path + "/NativeScript/resources"
    src_root = File.expand_path("..", pods_path)
    @internal_dest = File.expand_path("internal", src_root)
    FileUtils.copy_entry internal_path, @internal_dest 
    main_target = nil
    installer.aggregate_targets.each do |target|
        user_project = target.user_project
        user_project.build_configurations.each do |config|
   
            config.build_settings["ENABLE_BITCODE"] = "NO"
            config.build_settings["CLANG_ENABLE_MODULES"] = "NO"
            config.build_settings["LD"] = "$SRCROOT/internal/nsld.sh"
            config.build_settings["LDPLUSPLUS"] = "$SRCROOT/internal/nsld.sh"
            config.build_settings["OTHER_LDFLAGS"] = '$(inherited) -framework WebKit$(inherited) -ObjC -sectcreate __DATA __TNSMetadata $(CONFIGURATION_BUILD_DIR)/metadata-$(CURRENT_ARCH).bin -F $(SRCROOT)/internal -licucore -lz -lc++ -framework Foundation -framework UIKit -framework CoreGraphics -framework MobileCoreServices -framework Security'
        end
        main_target = user_project.targets.first
   
    end
   
   
   sources_index = nil
   main_target.build_phases.each_with_index do |phase, i|
     if phase.class.name == "Xcodeproj::Project::Object::PBXSourcesBuildPhase"
       sources_index = i
     end
   end
   
   pre_build = main_target.new_shell_script_build_phase("NativeScript PreBuild")
   pre_build.shell_script = "${SRCROOT}/internal/nativescript-pre-build"
   
   main_target.build_phases.move_from(main_target.build_phases.length-1, sources_index)
   
   link_index = nil
   main_target.build_phases.each_with_index do |phase, i|
     if phase.class.name == "Xcodeproj::Project::Object::PBXFrameworksBuildPhase"
       link_index = i
     end
   end
   
   pre_link = main_target.new_shell_script_build_phase("NativeScript PreLink")
   pre_link.shell_script = "${SRCROOT}/internal/nativescript-pre-link"
   
   main_target.build_phases.move_from(main_target.build_phases.length-1, link_index)
   
   
end
   
def save_current_state(installer)
     @state = Hash.new
   
     main_target = nil
     
     user_project = nil
     installer.aggregate_targets.each do |target|
         user_project = target.user_project
   
     end
     
     user_project.build_configurations.each do |config|
           @state[config.name] = Hash.new
           @state[config.name]["settings"] = {
             "ENABLE_BITCODE": config.build_settings["ENABLE_BITCODE"],
             "CLANG_ENABLE_MODULES": config.build_settings["ENABLE_BITCODE"],
             "LD": config.build_settings["LD"],
             "LDPLUSPLUS": config.build_settings["LDPLUSPLUS"],
             "OTHER_LDFLAGS": config.build_settings["OTHER_LDFLAGS"],
             "USER_HEADER_SEARCH_PATHS": config.build_settings["USER_HEADER_SEARCH_PATHS"],
             "SWIFT_OBJC_BRIDGING_HEADER": config.build_settings["SWIFT_OBJC_BRIDGING_HEADER"]
           }
     end
     
     main_target = user_project.targets.first
     @state["main_target_build_phases"] = main_target.build_phases
     json = @state.to_json
     
     File.write('./pre-ns-state.json', json)
     
end
   
def nativescript_restore_state(installer)
     file = File.read('./pre-ns-state.json')
     state_hash = JSON.parse(file)
     #restore settings
     user_project = nil
     installer.aggregate_targets.each do |target|
         user_project = target.user_project
   
     end
     
     restore_state(user_project) 
end

def get_appdelegate_path(user_project)
  src_root = File.expand_path("..", user_project.path)
  app_delegate_path = File.expand_path('./App/AppDelegate.swift', src_root)
  return app_delegate_path
end

def save_appdelegate(content, user_project)
  File.write(get_appdelegate_path(user_project), content)
end

def get_podfile_path(user_project)
  src_root = File.expand_path("..", user_project.path)
  podfile_path = File.expand_path('./Podfile', src_root)
  return podfile_path
end

def save_podfile(content, user_project)
  File.write(get_podfile_path(user_project), content)
end

def get_ns_state_path(user_project)
  src_root = File.expand_path("..", user_project.path)
  state_path = File.expand_path('./pre-ns-state.json', src_root)
  return state_path
end

def get_ns_state_hash(user_project) 
  state_path = get_ns_state_path(user_project)
  file = File.read(state_path)
  state_hash = JSON.parse(file)
  return state_hash
end

def save_ns_state_hash(hash, user_project)
  json = hash.to_json
  state_path = get_ns_state_path(user_project)
  File.write(state_path, json)
end

def restore_state(user_project)
  
    state_hash = get_ns_state_hash(user_project)
    main_target = user_project.targets.first
     
     user_project.build_configurations.each do |config|
       state_hash[config.name]["settings"].each do |key, value|
         if value
           config.build_settings[key] = value
           puts key
         else
           puts "deleting key " + key
           config.build_settings.delete(key)
         end
       end
     end
     
     main_target.build_phases.each do |phase|
       unless state_hash["main_target_build_phases"].include? phase.to_s
        puts "REMOVING PHASE:"
        puts phase.to_s
         phase.remove_from_project
       end
     end

    groups = state_hash["added_groups"]
    if groups && groups.length > 0 
      groups.each do |groupName|
        user_project.groups.each do |group|
          if group.name == groupName
            group.remove_from_project
          end
        end
      end
    end

    added_dirs = state_hash["added_dirs"]
    if added_dirs && added_dirs.length > 0
      added_dirs.each do |path|
        FileUtils.rm_rf(path)
      end
    end

    user_project.save

    podfile = File.read(get_podfile_path(user_project))
    podfile.slice! "require_relative '../../node_modules/@nativescript/capacitor/ios/nativescript.rb'"
    podfile.slice! "pod 'NativeScript'"
    podfile.slice! "pod 'NativeScriptUI'"
    podfile.slice! "nativescript_capacitor_post_install(installer)"

    save_podfile(podfile, user_project)

    appdelegate = File.read(get_appdelegate_path(user_project))
    puts appdelegate
    to_slice = [
      "var nativescript: NativeScript?",
      "// NativeScript init",
      "let nsConfig = Config.init()",
      "nsConfig.metadataPtr = runtimeMeta()",
      "// can turn off in production",
      "nsConfig.isDebug = true",
      "nsConfig.logToSystemConsole = nsConfig.isDebug",
      'nsConfig.baseDir = URL(string: "public", relativeTo: Bundle.main.resourceURL)?.path',
      'nsConfig.applicationPath = "nativescript"',
      "self.nativescript = NativeScript.init(config: nsConfig)"
    ]
    
    to_slice.each do |line|
      appdelegate.slice! line
    end

    save_appdelegate(appdelegate, user_project)
end

def command_restore_state(project_path)
  puts "Restoring project state..."
  require 'xcodeproj'
  require 'json'
  project = Xcodeproj::Project.open(project_path)
  puts project
  restore_state(project)
end

def nativescript_capacitor_post_install(installer)
  nativescript_post_install(installer)

  main_target = nil
  
  user_project = nil
  installer.aggregate_targets.each do |target|
      user_project = target.user_project
      user_project.build_configurations.each do |config|
          config.build_settings["SWIFT_OBJC_BRIDGING_HEADER"] = "$(SRCROOT)/NativeScript/App-Bridging-Header.h"
          config.build_settings["USER_HEADER_SEARCH_PATHS"] = "$(SRCROOT)/NativeScript"
      end
      main_target = user_project.targets.first
  
  end

  state_hash = get_ns_state_hash(user_project)

  #Add NativeScript group
  pods_path = File.expand_path("..", installer.pods_project.path)
  nativescript_dir_path = File.expand_path("../../../../node_modules/@nativescript/capacitor/embed/ios/NativeScript", installer.pods_project.path)
  src_root = File.expand_path("..", pods_path)
  ns_dir_dest = File.expand_path("NativeScript", src_root)

  FileUtils.copy_entry(nativescript_dir_path, ns_dir_dest)

  state_hash['added_dirs'] = [ns_dir_dest]

  ns_group = user_project.new_group('NativeScript')
  ns_path = ns_dir_dest
  addfiles("#{ns_path}/*", ns_group, main_target)

  state_hash['added_groups'] = ["NativeScript"]

  save_ns_state_hash(state_hash, user_project)

  user_project.save
  
end

if (@command == "clean")
  command_restore_state(@path)
end

