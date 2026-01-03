use crate::{LatLng, MapOptions, MapPosition, interop, types::Id};
use dioxus::{core::{use_drop, spawn_forever}, prelude::*};
use std::rc::Rc;

const MAP_CSS: Asset = asset!("/assets/dioxus_leaflet.css");

/// Main map component using Leaflet
#[component]
pub fn Map(
    /// Initial position of the map
    #[props(default = MapPosition::default())]
    initial_position: MapPosition,

    /// Height of the map container
    #[props(into)]
    height: Option<String>,

    /// Width of the map container
    #[props(into)]
    width: Option<String>,

    /// Map configuration options
    options: Option<MapOptions>,

    /// Custom CSS class for the map container
    #[props(into)]
    class: Option<String>,

    /// Custom CSS styles for the map container
    #[props(into)]
    style: Option<String>,

    /// Callback when map is clicked
    on_click: Option<EventHandler<LatLng>>,

    /// Callback when map is moved
    on_move: Option<EventHandler<MapPosition>>,

    children: Element,
) -> Element {
    let id = use_context_provider(|| Rc::new(Id::map(dioxus_core::current_scope_id().0)));
    let options = options.unwrap_or(MapOptions::default());
    let leaflet_css = options.leaflet_resources.css_url();
    let leaflet_js = options.leaflet_resources.js_url();

    // NOTE: Leaflet requires the target element to have a real (non-zero) layout size.
    // If we don't apply these, the DOM can initialize but the map will be invisible.
    let height = height.unwrap_or_else(|| "500px".to_string());
    let width = width.unwrap_or_else(|| "100%".to_string());
    let container_style = match style {
        Some(s) if !s.trim().is_empty() => format!("width: {}; height: {}; {}", width, height, s),
        _ => format!("width: {}; height: {};", width, height),
    };

    let id2 = id.clone();
    let load_error = use_resource(move || {
        let id = id2.clone();
        let pos = initial_position.clone();
        let opts = options.clone();
        async move {
            interop::update_map(&id, &pos, &opts).await.map_err(|e| e.to_string())
        }
    });

    let id2 = id.clone();
    let _click_handle = use_resource(move || {
        let id = id2.clone();
        async move {
            if let Some(on_click) = on_click {
                interop::on_map_click(&id, on_click).await
            }
            else {
                Ok(())
            }
        }
    });

    let id2 = id.clone();
    let _move_handle = use_resource(move || {
        let id = id2.clone();
        async move {
            if let Some(on_move) = on_move {
                interop::on_map_move(&id, on_move).await
            }
            else {
                Ok(())
            }
        }
    });

    let id2 = id.clone();
    use_drop(move || {
        let id = id2.clone();
        spawn_forever(async move {
            _ = interop::delete_map(&id).await;
        });
    });

    rsx! {
        // Leaflet CSS
        document::Style { href: leaflet_css }

        document::Style { href: MAP_CSS }

        // Leaflet JavaScript
        document::Script { src: leaflet_js }

        // boot logic
        document::Script { src: interop::DL_JS, r#type: "module" }

        if let Some(Err(err)) = load_error() {
            p { "{err}" }
        } else {
            // Map container
            div {
                class: "dioxus-leaflet-container {class.as_ref().map(|c| c.as_str()).unwrap_or(\"\")}",
                style: "{container_style}",

                // Element taken over by leaflet
                div { id: "dioxus-leaflet-{id}", class: "dioxus-leaflet-map", {children} }
            }
        }
    }
}
