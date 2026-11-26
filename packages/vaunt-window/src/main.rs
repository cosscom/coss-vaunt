//! The desktop window `npx vaunt start` opens the studio in.
//!
//! It is only a window: the Node launcher (`packages/vaunt/bin/vaunt.mjs`) runs the studio server and passes its
//! address as the first argument. The process exits when the last window closes, and the launcher then stops the
//! server.

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
};

use tauri::{
    webview::{DownloadEvent, NewWindowFeatures, NewWindowResponse},
    AppHandle, TitleBarStyle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

const DEFAULT_URL: &str = "http://localhost:3102";

/// Height of the macOS title bar the content now runs under.
const TITLE_BAR_INSET: u32 = 28;

/// Runs in every page before it loads. The window has no visible title bar on macOS, so the page learns how much
/// room the window buttons take (`--titlebar-inset`, used by the studio's layout) and gets an invisible strip along
/// the top to drag the window by (Tauri's `data-tauri-drag-region`; double-click zooms).
fn title_bar_script() -> String {
    format!(
        r#"(() => {{
  if (!/Mac/.test(navigator.platform)) return;
  const root = document.documentElement;
  root.dataset.vauntWindow = "";
  const style = document.createElement("style");
  style.textContent = ":root {{ --titlebar-inset: {inset}px; }}";
  root.appendChild(style);
  const addStrip = () => {{
    const strip = document.createElement("div");
    strip.setAttribute("data-tauri-drag-region", "");
    strip.setAttribute("aria-hidden", "true");
    strip.style.cssText = "position:fixed;top:0;left:0;right:0;height:{inset}px;z-index:2147483000";
    document.body.appendChild(strip);
  }};
  if (document.readyState === "complete") addStrip();
  else addEventListener("load", addStrip, {{ once: true }});
}})();"#,
        inset = TITLE_BAR_INSET
    )
}

/// Each window needs a unique label; `window.open` makes more than the first.
static WINDOWS: AtomicUsize = AtomicUsize::new(0);

/// The studio and everything it links to inside itself is served from loopback.
fn is_studio(url: &Url) -> bool {
    match url.scheme() {
        "http" | "https" => matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")),
        // about:blank, blob: and data: frames the page makes itself.
        _ => true,
    }
}

fn open_externally(url: &Url) {
    if let Err(error) = tauri_plugin_opener::open_url(url.as_str(), None::<&str>) {
        eprintln!("vaunt-window: couldn't open {url}: {error}");
    }
}

/// Opens a studio window at `url`. `features` is set when the page asked for it with `window.open`; WebKit then
/// needs the new window to share the opener's configuration.
fn studio_window(
    app: &AppHandle,
    url: Url,
    features: Option<NewWindowFeatures>,
) -> tauri::Result<WebviewWindow> {
    let label = format!("studio-{}", WINDOWS.fetch_add(1, Ordering::Relaxed));
    // Where each download is being saved, so it can be shown in Finder once it's done.
    let downloads: Arc<Mutex<HashMap<Url, PathBuf>>> = Default::default();
    let new_window_app = app.clone();

    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::External(url))
        // The window's name stays "coss vaunt" for the Dock, the Window menu and screen readers; it just isn't
        // drawn. The content runs up under the window buttons instead of below a title bar.
        .title("coss vaunt")
        .hidden_title(true)
        .title_bar_style(TitleBarStyle::Overlay)
        .initialization_script(title_bar_script())
        .inner_size(1440.0, 900.0)
        .min_inner_size(960.0, 600.0)
        // The timeline and media panel take OS file drops through HTML5 drag-and-drop; Tauri's own handler would
        // swallow them.
        .disable_drag_drop_handler()
        .on_navigation(|url| {
            if is_studio(url) {
                return true;
            }
            open_externally(url);
            false
        })
        .on_new_window(move |url, features| {
            if !is_studio(&url) {
                open_externally(&url);
                return NewWindowResponse::Deny;
            }
            match studio_window(&new_window_app, url, Some(features)) {
                Ok(window) => NewWindowResponse::Create { window },
                Err(error) => {
                    eprintln!("vaunt-window: couldn't open a window: {error}");
                    NewWindowResponse::Deny
                }
            }
        })
        // Export downloads: WebKit has no download UI of its own. Wry saves to ~/Downloads under the suggested name,
        // numbering it if the name is taken; show the file once it's there.
        .on_download(move |_webview, event| {
            match event {
                DownloadEvent::Requested { url, destination } => {
                    downloads.lock().unwrap().insert(url, destination.clone());
                }
                DownloadEvent::Finished { url, success, .. } => {
                    let path = downloads.lock().unwrap().remove(&url);
                    match (success, path) {
                        (true, Some(path)) => {
                            if let Err(error) = tauri_plugin_opener::reveal_item_in_dir(&path) {
                                eprintln!(
                                    "vaunt-window: couldn't show {}: {error}",
                                    path.display()
                                );
                            }
                        }
                        (false, _) => eprintln!("vaunt-window: the download of {url} failed"),
                        _ => {}
                    }
                }
                _ => {}
            }
            true
        });
    if let Some(features) = features {
        builder = builder.window_features(features);
    }
    builder.build()
}

fn main() {
    let arg = std::env::args()
        .nth(1)
        .or_else(|| std::env::var("VAUNT_URL").ok())
        .unwrap_or_else(|| DEFAULT_URL.into());
    let url: Url = match arg.parse() {
        Ok(url) => url,
        Err(error) => {
            eprintln!("vaunt-window: {arg} isn't a URL: {error}");
            std::process::exit(2);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            studio_window(app.handle(), url.clone(), None)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("vaunt-window: couldn't start");
}
