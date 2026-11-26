fn main() {
    // `set_glass` is the window's own command; this generates its `allow-set-glass` permission, which
    // capabilities/window.json grants the studio's pages.
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(&["set_glass"]));
    tauri_build::try_build(attributes).expect("vaunt-window: tauri-build failed");
}
