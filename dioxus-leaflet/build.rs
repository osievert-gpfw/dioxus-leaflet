use std::path::PathBuf;
use std::process::Command;

use dioxus_use_js::BunBuild;

fn command_exists(command: &str) -> bool {
    Command::new(command)
        .arg("--version")
        .output()
        .is_ok()
}

fn main() {
    // Track changes to the TS sources so the bundler re-runs.
    println!("cargo:rerun-if-changed=js_utils/src");

    // Prefer Bun (fast, no extra deps). If it's not present, fall back to `npx esbuild`
    // so local builds still reflect edits to `js_utils/src/*.ts`.
    if command_exists("bun") {
        BunBuild::builder()
            .src_files(vec![PathBuf::from("js_utils/src/dioxus_leaflet.ts")])
            .output_dir(PathBuf::from("assets"))
            .skip_if_no_bun(false)
            .build()
            .run();
        return;
    }

    // If npm/npx exists, use esbuild as a bundler.
    if !command_exists("npx") {
        // Keep the old behavior: use the prebuilt `assets/dioxus_leaflet.js`.
        eprintln!("[dioxus-leaflet build.rs] bun not found and npx not found; using prebuilt assets/dioxus_leaflet.js");
        return;
    }

    let assets_dir = PathBuf::from("assets");
    let _ = std::fs::create_dir_all(&assets_dir);

    let entry = "js_utils/src/dioxus_leaflet.ts";
    let outfile = assets_dir.join("dioxus_leaflet.js");

    let status = Command::new("npx")
        .args([
            "--yes",
            "esbuild",
            entry,
            "--bundle",
            "--format=esm",
            &format!("--outfile={}", outfile.display()),
        ])
        .status();

    match status {
        Ok(s) if s.success() => {}
        Ok(s) => {
            eprintln!("[dioxus-leaflet build.rs] esbuild failed with status {s}; using existing assets/dioxus_leaflet.js");
        }
        Err(e) => {
            eprintln!("[dioxus-leaflet build.rs] failed to run npx esbuild ({e}); using existing assets/dioxus_leaflet.js");
        }
    }
}