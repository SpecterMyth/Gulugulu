use std::path::PathBuf;

fn main() {
    tauri_build::build();
    copy_steam_redistributable();
}

/// 把 steamworks-sys 附带的 steam_api 运行时库拷到 target 目录（exe 旁），
/// 否则动态加载失败、进程起不来。找不到只警告不失败（CI 其他平台/离线环境）。
fn copy_steam_redistributable() {
    let (dll_rel, dll_name) = if cfg!(target_os = "windows") {
        ("redistributable_bin/win64/steam_api64.dll", "steam_api64.dll")
    } else if cfg!(target_os = "macos") {
        ("redistributable_bin/osx/libsteam_api.dylib", "libsteam_api.dylib")
    } else {
        ("redistributable_bin/linux64/libsteam_api.so", "libsteam_api.so")
    };

    let Some(source) = find_in_cargo_registry(dll_rel) else {
        println!("cargo:warning=steam redistributable not found in cargo registry; place {dll_name} next to the exe manually");
        return;
    };

    // OUT_DIR = <target>/<profile>/build/<pkg>-<hash>/out → 上溯 3 级 = profile 目录。
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap_or_default());
    let Some(profile_dir) = out_dir.ancestors().nth(3).map(PathBuf::from) else {
        return;
    };
    let dest = profile_dir.join(dll_name);
    if let Err(error) = std::fs::copy(&source, &dest) {
        println!("cargo:warning=failed to copy {dll_name} to {}: {error}", dest.display());
    }
}

fn find_in_cargo_registry(rel: &str) -> Option<PathBuf> {
    let cargo_home = std::env::var("CARGO_HOME")
        .map(PathBuf::from)
        .ok()
        .or_else(|| std::env::var("USERPROFILE").map(|p| PathBuf::from(p).join(".cargo")).ok())
        .or_else(|| std::env::var("HOME").map(|p| PathBuf::from(p).join(".cargo")).ok())?;
    let registry_src = cargo_home.join("registry").join("src");
    let mut newest: Option<PathBuf> = None;
    for index_dir in std::fs::read_dir(&registry_src).ok()?.flatten() {
        let Ok(crates) = std::fs::read_dir(index_dir.path()) else {
            continue;
        };
        for entry in crates.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("steamworks-sys-") {
                continue;
            }
            let candidate = entry.path().join("lib").join("steam").join(rel);
            if candidate.exists() {
                // 简单取字典序最新版本。
                if newest.as_ref().map(|n| candidate > *n).unwrap_or(true) {
                    newest = Some(candidate);
                }
            }
        }
    }
    newest
}
