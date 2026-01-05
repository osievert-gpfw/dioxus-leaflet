use dioxus::prelude::*;
use dioxus_logger::tracing::error;
use std::{collections::HashMap, rc::Rc};

use crate::{LatLng, MarkerIcon, interop, types::Id};

#[component]
pub fn Marker(
    coordinate: ReadSignal<LatLng>,

    #[props(default = None)] icon: ReadSignal<Option<MarkerIcon>>,

    #[props(default = None)] custom_data: ReadSignal<Option<HashMap<String, String>>>,

    on_click: Option<EventHandler>,

    children: Element,
) -> Element {
    let map: Rc<Id> = use_context();
    let id = use_context_provider(|| Rc::new(Id::marker(&map, dioxus_core::current_scope_id().0)));

    let id2 = id.clone();
    use_effect(move || {
        let id = id2.clone();
        let coord = coordinate();
        let icon = icon();
        spawn(async move {
            if let Err(e) = interop::update_marker(&id, &coord, &icon).await {
                error!("Error rendering marker: {e}");
            }
        });
    });

    // Intentionally do not call into JS on marker drop.  In practice, apps may need to
    // rebuild/remount the whole map when the marker set changes. Leaflet will clean up marker
    // DOM/layers when the map is removed, and skipping per-marker delete avoids a flood of JS
    // evals during teardown (which has been observed to destabilize embedded WebViews).

    rsx!(
        {children}
    )
}
