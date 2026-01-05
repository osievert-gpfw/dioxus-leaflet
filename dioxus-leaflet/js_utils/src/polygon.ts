import { setup } from "./util";
import { get_map } from "./map";
import type { L, Id, Json } from "./types";
import { get_popup } from "./popup";

const _gons_by_map = new Map<Id, Map<Id, L.Polygon>>();

function map_polygons(map_id: Id): Map<Id, L.Polygon> {
    let m = _gons_by_map.get(map_id);
    if (!m) {
        m = new Map<Id, L.Polygon>();
        _gons_by_map.set(map_id, m);
    }
    return m;
}

export function get_polygon(map_id: Id, polygon_id: Id): L.Polygon | undefined {
    return _gons_by_map.get(map_id)?.get(polygon_id);
}

export async function update_polygon(map_id: Id, polygon_id: Id, coordinates: L.LatLngLiteral[][][], options: L.PathOptions) {
    const l = await setup();
    const map = await get_map(map_id);
    if (!map) {
        throw new Error(`Map with id ${map_id} not found when updating polygon ${polygon_id}`);
    }

    const gons = map_polygons(map_id);
    const gon = gons.get(polygon_id) ?? l.polygon([]).addTo(map);
    gons.set(polygon_id, gon);

    gon.setLatLngs(coordinates);
    gon.setStyle(options);

    const popup = get_popup(map_id, polygon_id);
    if (popup) {
        gon.unbindPopup();
        gon.bindPopup(popup.body, popup.options);
    }
}

export async function delete_polygon(map_id: Id, polygon_id: Id) {
    await setup();
    const map = await get_map(map_id);
    if (!map) {
        return;
    }

    const gons = _gons_by_map.get(map_id);
    if (!gons) {
        return;
    }

    const gon = gons.get(polygon_id);
    if (!gon) {
        return;
    }

    try {
        map.removeLayer(gon);
    } catch {
        // Ignore
    }
    gons.delete(polygon_id);
    if (gons.size === 0) {
        _gons_by_map.delete(map_id);
    }
}

export async function clear_polygons(map_id: Id) {
    await setup();
    const map = await get_map(map_id);
    const gons = _gons_by_map.get(map_id);
    if (!gons) {
        return;
    }

    if (map) {
        for (const gon of gons.values()) {
            try {
                map.removeLayer(gon);
            } catch {
                // Ignore
            }
        }
    }
    _gons_by_map.delete(map_id);
}