import type { L, Id } from "./types";
import { get_map } from "./map";
import { setup } from "./util";
import { get_popup } from "./popup";

const _markers_by_map = new Map<Id, Map<Id, L.Marker>>();
const _pending_marker_sets = new Map<Id, MarkerSpec[]>();

export type MarkerSpec = {
    id: Id,
    coordinate: L.LatLngExpression,
    icon?: L.IconOptions,
};

function map_markers(map_id: Id): Map<Id, L.Marker> {
    let m = _markers_by_map.get(map_id);
    if (!m) {
        m = new Map<Id, L.Marker>();
        _markers_by_map.set(map_id, m);
    }
    return m;
}

function ensure_on_map(map: L.Map, marker: L.Marker) {
    try {
        // If we reuse a cached marker, it might not currently be attached
        // to this Leaflet map (e.g. after overlay close/reopen).
        // @ts-ignore
        if (!map.hasLayer(marker)) {
            marker.addTo(map);
        }
    } catch {
        // ignore
    }
}

export function get_marker(map_id: Id, marker_id: Id): L.Marker | undefined {
    return _markers_by_map.get(map_id)?.get(marker_id);
}

export async function update_marker(map_id: Id, marker_id: Id, coordinate: L.LatLngExpression, icon?: L.IconOptions) {
    const l = await setup();
    const map = await get_map(map_id);
    if (!map) {
        // Map not ready yet; queue as a marker-set update so it applies once the map mounts.
        _pending_marker_sets.set(map_id, [{ id: marker_id, coordinate, icon }]);
        return;
    }

    const markers = map_markers(map_id);
    const marker = markers.get(marker_id) ?? l.marker([0, 0]).addTo(map);
    markers.set(marker_id, marker);

    ensure_on_map(map, marker);

    marker.setLatLng(coordinate);
    if (icon) {
        marker.setIcon(l.icon(icon));
    }

    const popup = get_popup(map_id, marker_id);
    if (popup) {
        marker.unbindPopup();
        marker.bindPopup(popup.body, popup.options);
    }
}

export function clear_pending_markers(map_id: Id) {
    _pending_marker_sets.delete(map_id);
}

export async function flush_pending_markers(map_id: Id) {
    const pending = _pending_marker_sets.get(map_id);
    if (!pending || pending.length === 0) {
        return;
    }
    _pending_marker_sets.delete(map_id);
    await set_markers(map_id, pending);
}

// Reconcile the entire marker set for a map in one JS eval.
// This avoids a large number of individual `delete_marker` evals during UI updates,
// while still allowing stale markers to be removed so the view stays accurate.
export async function set_markers(map_id: Id, next: MarkerSpec[]) {
    const l = await setup();
    const map = await get_map(map_id);
    if (!map) {
        // Map not ready yet (common during initial mount). Save the latest snapshot.
        _pending_marker_sets.set(map_id, next);
        return;
    }

    const markers = map_markers(map_id);
    const next_ids = new Set<Id>();

    for (const spec of next) {
        next_ids.add(spec.id);

        const marker = markers.get(spec.id) ?? l.marker([0, 0]).addTo(map);
        markers.set(spec.id, marker);

        ensure_on_map(map, marker);

        try {
            marker.setLatLng(spec.coordinate);
            if (spec.icon) {
                marker.setIcon(l.icon(spec.icon));
            }
        } catch {
            // Ignore update errors (map may be disposing or DOM may be in flux).
        }

        const popup = get_popup(map_id, spec.id);
        if (popup) {
            try {
                marker.unbindPopup();
                marker.bindPopup(popup.body, popup.options);
            } catch {
                // Ignore
            }
        }
    }

    // Remove stale markers.
    for (const [id, marker] of markers.entries()) {
        if (next_ids.has(id)) {
            continue;
        }
        try {
            map.removeLayer(marker);
        } catch {
            // Ignore
        }
        markers.delete(id);
    }

    if (markers.size === 0) {
        _markers_by_map.delete(map_id);
    }
}

export async function delete_marker(map_id: Id, marker_id: Id) {
    await setup();
    const map = await get_map(map_id);
    const markers = _markers_by_map.get(map_id);
    if (!markers) {
        return;
    }

    const marker = markers.get(marker_id);
    if (!marker) {
        return;
    }

    if (map) {
        try {
            map.removeLayer(marker);
        } catch {
            // Ignore removal errors; the map may already be disposing.
        }
    }
    markers.delete(marker_id);
    if (markers.size === 0) {
        _markers_by_map.delete(map_id);
    }
}

export async function clear_markers(map_id: Id) {
    await setup();
    const map = await get_map(map_id);
    const markers = _markers_by_map.get(map_id);
    if (!markers) {
        return;
    }

    if (map) {
        for (const marker of markers.values()) {
            try {
                map.removeLayer(marker);
            } catch {
                // Ignore
            }
        }
    }

    _markers_by_map.delete(map_id);
    _pending_marker_sets.delete(map_id);
}