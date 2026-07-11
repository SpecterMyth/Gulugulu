use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{copy, Cursor, Read};
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvatarAnimationManifest {
    pub frames: u32,
    pub fps: u32,
    #[serde(rename = "loop")]
    pub loop_: bool,
    pub frame_path_template: String,
    pub webp_path: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvatarManifest {
    pub id: String,
    pub name: String,
    pub version: u32,
    pub frame_size: AvatarSize,
    pub anchor: AvatarPoint,
    pub animations: BTreeMap<String, AvatarAnimationManifest>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvatarSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvatarPoint {
    pub x: u32,
    pub y: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledAvatar {
    pub id: String,
    pub name: String,
    pub builtin: bool,
    pub root_path: Option<String>,
    pub preview_path: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvatarSelection {
    pub current_id: String,
    pub manifest: AvatarManifest,
    pub root_path: Option<String>,
    pub avatars: Vec<InstalledAvatar>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AvatarConfig {
    current_id: String,
}

const BUILTIN_AVATAR_ID: &str = "guluduck";
const AVATAR_GEN_DEFAULT_URL: &str = "http://127.0.0.1:4177";
const AVATAR_GEN_API_DEFAULT_URL: &str = "http://127.0.0.1:4178";
/// Clean full-body reference used when the built-in Guluduck is a fusion parent.
const GULUDUCK_REFERENCE: &[u8] = include_bytes!("../assets/guluduck-reference.png");

pub fn open_avatar_generator(_app: AppHandle) -> Result<(), String> {
    let url = std::env::var("AVATAR_GEN_URL").unwrap_or_else(|_| AVATAR_GEN_DEFAULT_URL.to_string());
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|error| error.to_string())
}

#[derive(Deserialize)]
struct FusionJobCreated {
    #[serde(rename = "jobId")]
    job_id: String,
}

#[derive(Deserialize)]
struct FusionJobStatus {
    status: String,
    error: Option<String>,
}

fn avatar_gen_api_base() -> String {
    std::env::var("AVATAR_GEN_API_URL").unwrap_or_else(|_| AVATAR_GEN_API_DEFAULT_URL.to_string())
}

/// Resolve the reference image bytes for a pet: the built-in ships a bundled
/// reference; installed pets use their clean standard-design (or preview) art.
fn reference_image_bytes(avatar: &InstalledAvatar) -> Result<Vec<u8>, String> {
    if avatar.builtin {
        return Ok(GULUDUCK_REFERENCE.to_vec());
    }
    let root = avatar
        .root_path
        .as_ref()
        .ok_or_else(|| format!("Pet \"{}\" has no files on disk.", avatar.name))?;
    let root_path = PathBuf::from(root);
    for candidate in ["standard-design.png", "preview.png"] {
        let path = root_path.join(candidate);
        if path.exists() {
            return fs::read(&path).map_err(|error| error.to_string());
        }
    }
    Err(format!("Pet \"{}\" has no reference image to fuse.", avatar.name))
}

/// Fuse two installed pets into a new one via the avatar-gen service, then
/// install and switch to the result. Blocking (runs on a background thread via
/// the async command wrapper), because the fusion job takes minutes.
pub fn fuse_avatars(
    app: AppHandle,
    id_a: String,
    id_b: String,
    provider: Option<String>,
    model: Option<String>,
) -> Result<AvatarSelection, String> {
    if id_a == id_b {
        return Err("Pick two different pets to fuse.".to_string());
    }
    let avatars = list_avatars(app.clone())?;
    let avatar_a = avatars
        .iter()
        .find(|avatar| avatar.id == id_a)
        .ok_or_else(|| "The first pet is not installed.".to_string())?;
    let avatar_b = avatars
        .iter()
        .find(|avatar| avatar.id == id_b)
        .ok_or_else(|| "The second pet is not installed.".to_string())?;

    let name_a = avatar_a.name.clone();
    let name_b = avatar_b.name.clone();
    let bytes_a = reference_image_bytes(avatar_a)?;
    let bytes_b = reference_image_bytes(avatar_b)?;

    let base = avatar_gen_api_base();
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30 * 60))
        .build()
        .map_err(|error| error.to_string())?;

    let mut form = reqwest::blocking::multipart::Form::new()
        .text("nameA", name_a)
        .text("nameB", name_b)
        .part(
            "imageA",
            reqwest::blocking::multipart::Part::bytes(bytes_a)
                .file_name("a.png")
                .mime_str("image/png")
                .map_err(|error| error.to_string())?,
        )
        .part(
            "imageB",
            reqwest::blocking::multipart::Part::bytes(bytes_b)
                .file_name("b.png")
                .mime_str("image/png")
                .map_err(|error| error.to_string())?,
        );
    if let Some(value) = provider.filter(|value| !value.trim().is_empty()) {
        form = form.text("provider", value);
    }
    if let Some(value) = model.filter(|value| !value.trim().is_empty()) {
        form = form.text("model", value);
    }

    let response = client
        .post(format!("{base}/api/fusions"))
        .multipart(form)
        .send()
        .map_err(|error| format!("Could not reach the avatar generator at {base}. Is it running? ({error})"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(format!("Fusion request failed ({status}): {}", body.trim()));
    }
    let created: FusionJobCreated = response.json().map_err(|error| error.to_string())?;
    let job_id = created.job_id;

    let deadline = Instant::now() + Duration::from_secs(30 * 60);
    loop {
        std::thread::sleep(Duration::from_secs(2));
        if Instant::now() > deadline {
            return Err("Fusion timed out; your pet was not changed.".to_string());
        }
        let status: FusionJobStatus = client
            .get(format!("{base}/api/jobs/{job_id}"))
            .send()
            .map_err(|error| error.to_string())?
            .json()
            .map_err(|error| error.to_string())?;
        match status.status.as_str() {
            "complete" => break,
            "failed" => return Err(status.error.unwrap_or_else(|| "Fusion failed.".to_string())),
            _ => continue,
        }
    }

    let package = client
        .get(format!("{base}/api/jobs/{job_id}/package"))
        .send()
        .map_err(|error| error.to_string())?;
    if !package.status().is_success() {
        return Err(format!("Fusion package download failed: {}", package.status()));
    }
    let bytes = package.bytes().map_err(|error| error.to_string())?;
    install_avatar_zip_bytes(app, bytes.as_ref())
}

pub fn list_avatars(app: AppHandle) -> Result<Vec<InstalledAvatar>, String> {
    let mut avatars = vec![InstalledAvatar {
        id: BUILTIN_AVATAR_ID.to_string(),
        name: "Guluduck".to_string(),
        builtin: true,
        root_path: None,
        preview_path: Some("/animations/guluduck/overview.png".to_string()),
    }];

    let avatars_dir = avatars_dir(&app)?;
    if avatars_dir.exists() {
        for entry in fs::read_dir(&avatars_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            if !entry.file_type().map_err(|error| error.to_string())?.is_dir() {
                continue;
            }
            let manifest_path = entry.path().join("manifest.json");
            if !manifest_path.exists() {
                continue;
            }
            let manifest = read_manifest(&manifest_path)?;
            avatars.push(InstalledAvatar {
                id: manifest.id,
                name: manifest.name,
                builtin: false,
                root_path: Some(entry.path().to_string_lossy().to_string()),
                preview_path: Some(entry.path().join("preview.png").to_string_lossy().to_string()),
            });
        }
    }

    Ok(avatars)
}

pub fn get_current_avatar(app: AppHandle) -> Result<AvatarSelection, String> {
    let avatars = list_avatars(app.clone())?;
    let configured_id = read_config(&app)?.current_id;
    let selected = avatars
        .iter()
        .find(|avatar| avatar.id == configured_id)
        .unwrap_or_else(|| &avatars[0]);

    if selected.builtin {
        return Ok(AvatarSelection {
            current_id: BUILTIN_AVATAR_ID.to_string(),
            manifest: builtin_manifest(),
            root_path: None,
            avatars,
        });
    }

    let root_path = selected
        .root_path
        .clone()
        .ok_or_else(|| "Installed avatar is missing a root path.".to_string())?;
    let manifest = read_manifest(&PathBuf::from(&root_path).join("manifest.json"))?;
    Ok(AvatarSelection {
        current_id: manifest.id.clone(),
        manifest,
        root_path: Some(root_path),
        avatars,
    })
}

pub fn set_current_avatar(app: AppHandle, id: String) -> Result<AvatarSelection, String> {
    let avatars = list_avatars(app.clone())?;
    if !avatars.iter().any(|avatar| avatar.id == id) {
        return Err("Avatar is not installed.".to_string());
    }
    write_config(&app, &AvatarConfig { current_id: id })?;
    get_current_avatar(app)
}

pub fn install_avatar_from_url(app: AppHandle, url: String) -> Result<AvatarSelection, String> {
    let response = reqwest::blocking::get(url).map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Avatar package download failed: {}", response.status()));
    }
    let bytes = response.bytes().map_err(|error| error.to_string())?;
    install_avatar_zip_bytes(app, bytes.as_ref())
}

fn install_avatar_zip_bytes(app: AppHandle, bytes: &[u8]) -> Result<AvatarSelection, String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|error| error.to_string())?;
    let manifest = {
        let mut file = archive.by_name("manifest.json").map_err(|_| "Avatar package is missing manifest.json.".to_string())?;
        let mut json = String::new();
        file.read_to_string(&mut json).map_err(|error| error.to_string())?;
        serde_json::from_str::<AvatarManifest>(&json).map_err(|error| error.to_string())?
    };
    validate_manifest(&manifest)?;

    let target_dir = avatars_dir(&app)?.join(&manifest.id);
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|error| error.to_string())?;
        if file.is_dir() {
            continue;
        }
        let enclosed = enclosed_name(file.name())?;
        let output_path = target_dir.join(enclosed);
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut output = File::create(&output_path).map_err(|error| error.to_string())?;
        copy(&mut file, &mut output).map_err(|error| error.to_string())?;
    }

    write_config(&app, &AvatarConfig { current_id: manifest.id })?;
    get_current_avatar(app)
}

fn validate_manifest(manifest: &AvatarManifest) -> Result<(), String> {
    if manifest.version != 1 {
        return Err("Unsupported avatar manifest version.".to_string());
    }
    if manifest.id.trim().is_empty() || manifest.id.contains(['/', '\\', ':']) {
        return Err("Avatar manifest has an invalid id.".to_string());
    }
    if !manifest.animations.contains_key("idle_normal") {
        return Err("Avatar manifest is missing animation idle_normal.".to_string());
    }
    for (key, animation) in &manifest.animations {
        if animation.frames == 0 || animation.fps == 0 {
            return Err(format!("Avatar animation {key} has invalid timing."));
        }
        if animation.frame_path_template.trim().is_empty() {
            return Err(format!("Avatar animation {key} is missing framePathTemplate."));
        }
        if animation.webp_path.trim().is_empty() {
            return Err(format!("Avatar animation {key} is missing webpPath."));
        }
    }
    Ok(())
}

fn enclosed_name(name: &str) -> Result<PathBuf, String> {
    let path = Path::new(name);
    if path.is_absolute() {
        return Err("Avatar package contains an absolute path.".to_string());
    }
    let mut output = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => output.push(value),
            Component::CurDir => {}
            _ => return Err("Avatar package contains an unsafe path.".to_string()),
        }
    }
    Ok(output)
}

fn read_manifest(path: &Path) -> Result<AvatarManifest, String> {
    let json = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let manifest = serde_json::from_str::<AvatarManifest>(&json).map_err(|error| error.to_string())?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

fn avatars_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("avatars"))
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("avatar-config.json"))
}

fn read_config(app: &AppHandle) -> Result<AvatarConfig, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(AvatarConfig {
            current_id: BUILTIN_AVATAR_ID.to_string(),
        });
    }
    let json = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&json).map_err(|error| error.to_string())
}

fn write_config(app: &AppHandle, config: &AvatarConfig) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, serde_json::to_vec_pretty(config).map_err(|error| error.to_string())?).map_err(|error| error.to_string())
}

fn builtin_manifest() -> AvatarManifest {
    let mut animations = BTreeMap::new();
    for (key, frames, fps, loop_) in [
        ("idle_normal", 12, 8, true),
        ("blink", 6, 12, false),
        ("walk", 8, 10, true),
        ("turn_around", 10, 12, false),
        ("happy_dance", 16, 12, false),
        ("confused", 12, 10, false),
        ("scared_backstep", 14, 12, false),
        ("angry_backturn", 12, 10, false),
        ("agent_thinking", 12, 8, true),
        ("agent_success", 14, 12, false),
        ("eat", 16, 10, false),
        ("pet_head", 14, 10, false),
    ] {
        animations.insert(
            key.to_string(),
            AvatarAnimationManifest {
                frames,
                fps,
                loop_,
                frame_path_template: format!("/animations/guluduck/frames/{key}/{key}_{{frame}}.png"),
                webp_path: format!("/animations/guluduck/webp/{key}.webp"),
            },
        );
    }

    AvatarManifest {
        id: BUILTIN_AVATAR_ID.to_string(),
        name: "Guluduck".to_string(),
        version: 1,
        frame_size: AvatarSize {
            width: 768,
            height: 768,
        },
        anchor: AvatarPoint { x: 384, y: 700 },
        animations,
    }
}
