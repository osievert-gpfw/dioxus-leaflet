import { L, Id } from "./types";
import { get_marker } from "./marker";
import { get_polygon } from "./polygon";
import { setup } from "./util";

type PopupRecord = {
    body: HTMLElement,
    options: L.PopupOptions,
};

const _popups_by_map = new Map<Id, Map<Id, PopupRecord>>();

function map_popups(map_id: Id): Map<Id, PopupRecord> {
    let m = _popups_by_map.get(map_id);
    if (!m) {
        m = new Map<Id, PopupRecord>();
        _popups_by_map.set(map_id, m);
    }
    return m;
}

export function get_popup(map_id: Id, object_id: Id): PopupRecord | undefined {
    return _popups_by_map.get(map_id)?.get(object_id);
}

export function clear_popups(map_id: Id) {
    _popups_by_map.delete(map_id);
}

export async function update_popup(map_id: Id, object_id: Id, popup_id: Id, options: L.PopupOptions) {
    const l = await setup();
    const id = `dioxus-leaflet-popup-${popup_id}`;
    const body = document.getElementById(id);
    if (!body) {
        throw new Error(`Popup body element with id ${id} not found when updating popup for object ${object_id}`);
    }
    map_popups(map_id).set(object_id, { body, options });

    let context = get_marker(map_id, object_id) ?? get_polygon(map_id, object_id);
    if (context) {
        context.unbindPopup();
        context.bindPopup(body, options);
    }
}