use dioxus::prelude::*;
use dioxus_logger::tracing::error;
use std::rc::Rc;

use crate::{interop, types::Id};

#[derive(Clone, PartialEq, Props)]
pub struct MarkerSetProps {
    pub markers: Vec<interop::MarkerSpec>,
}

/// Update all markers for a map in a single JS eval.
///
/// This is intended to be more robust in embedded WebViews than adding/removing
/// many Marker components individually.
#[component]
pub fn MarkerSet(props: MarkerSetProps) -> Element {
    let map: Rc<Id> = use_context();

    // Hash markers so we can avoid repeated JS calls for identical inputs.
    let mut last_hash = use_signal(|| 0u64);

    let map_id = map.clone();
    let markers = props.markers.clone();
    use_effect(move || {
        // Cheap-ish stable hash (order-sensitive). Order is stable in the caller.
        let mut h: u64 = 1469598103934665603;
        for m in &markers {
            h ^= m.id as u64;
            h = h.wrapping_mul(1099511628211);
            h ^= m.coordinate.lat.to_bits() as u64;
            h = h.wrapping_mul(1099511628211);
            h ^= m.coordinate.lng.to_bits() as u64;
            h = h.wrapping_mul(1099511628211);
        }

        if h == last_hash() {
            return;
        }
        last_hash.set(h);

        let map_id = map_id.clone();
        let markers = markers.clone();
        spawn(async move {
            if let Err(e) = interop::set_markers(&map_id, &markers).await {
                error!("Error setting markers: {e}");
            }
        });
    });

    rsx!(
        {}

    )
}
