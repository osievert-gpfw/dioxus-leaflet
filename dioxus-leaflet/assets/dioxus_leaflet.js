// js_utils/src/util.ts
async function setup() {
  let l = window.L;
  while (!l) {
    await wait(100);
    l = window.L;
  }
  return l;
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// js_utils/src/polygon.ts
var _gons_by_map = /* @__PURE__ */ new Map();
function map_polygons(map_id) {
  let m = _gons_by_map.get(map_id);
  if (!m) {
    m = /* @__PURE__ */ new Map();
    _gons_by_map.set(map_id, m);
  }
  return m;
}
function get_polygon(map_id, polygon_id) {
  return _gons_by_map.get(map_id)?.get(polygon_id);
}
async function update_polygon(map_id, polygon_id, coordinates, options) {
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
async function delete_polygon(map_id, polygon_id) {
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
  }
  gons.delete(polygon_id);
  if (gons.size === 0) {
    _gons_by_map.delete(map_id);
  }
}
async function clear_polygons(map_id) {
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
      }
    }
  }
  _gons_by_map.delete(map_id);
}

// js_utils/src/popup.ts
var _popups_by_map = /* @__PURE__ */ new Map();
function map_popups(map_id) {
  let m = _popups_by_map.get(map_id);
  if (!m) {
    m = /* @__PURE__ */ new Map();
    _popups_by_map.set(map_id, m);
  }
  return m;
}
function get_popup(map_id, object_id) {
  return _popups_by_map.get(map_id)?.get(object_id);
}
function clear_popups(map_id) {
  _popups_by_map.delete(map_id);
}
async function update_popup(map_id, object_id, popup_id, options) {
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

// js_utils/src/marker.ts
var _markers_by_map = /* @__PURE__ */ new Map();
var _pending_marker_sets = /* @__PURE__ */ new Map();
function map_markers(map_id) {
  let m = _markers_by_map.get(map_id);
  if (!m) {
    m = /* @__PURE__ */ new Map();
    _markers_by_map.set(map_id, m);
  }
  return m;
}
function ensure_on_map(map, marker) {
  try {
    if (!map.hasLayer(marker)) {
      marker.addTo(map);
    }
  } catch {
  }
}
function get_marker(map_id, marker_id) {
  return _markers_by_map.get(map_id)?.get(marker_id);
}
async function update_marker(map_id, marker_id, coordinate, icon) {
  const l = await setup();
  const map = await get_map(map_id);
  if (!map) {
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
function clear_pending_markers(map_id) {
  _pending_marker_sets.delete(map_id);
}
async function flush_pending_markers(map_id) {
  const pending = _pending_marker_sets.get(map_id);
  if (!pending || pending.length === 0) {
    return;
  }
  _pending_marker_sets.delete(map_id);
  await set_markers(map_id, pending);
}
async function set_markers(map_id, next) {
  const l = await setup();
  const map = await get_map(map_id);
  if (!map) {
    _pending_marker_sets.set(map_id, next);
    return;
  }
  const markers = map_markers(map_id);
  const next_ids = /* @__PURE__ */ new Set();
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
    }
    const popup = get_popup(map_id, spec.id);
    if (popup) {
      try {
        marker.unbindPopup();
        marker.bindPopup(popup.body, popup.options);
      } catch {
      }
    }
  }
  for (const [id, marker] of markers.entries()) {
    if (next_ids.has(id)) {
      continue;
    }
    try {
      map.removeLayer(marker);
    } catch {
    }
    markers.delete(id);
  }
  if (markers.size === 0) {
    _markers_by_map.delete(map_id);
  }
}
async function delete_marker(map_id, marker_id) {
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
    }
  }
  markers.delete(marker_id);
  if (markers.size === 0) {
    _markers_by_map.delete(map_id);
  }
}
async function clear_markers(map_id) {
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
      }
    }
  }
  _markers_by_map.delete(map_id);
  _pending_marker_sets.delete(map_id);
}

// js_utils/src/map.ts
var _maps = /* @__PURE__ */ new Map();
var _tile_layers = /* @__PURE__ */ new Map();
var _callbacks = /* @__PURE__ */ new Map();
var _promises = /* @__PURE__ */ new Map();
var _deleted = /* @__PURE__ */ new Set();
async function get_map(map_id) {
  if (_deleted.has(map_id)) {
    return void 0;
  }
  let map = _maps.get(map_id);
  if (!map) {
    let p = _promises.get(map_id);
    if (!p) {
      p = new Promise((resolve) => {
        _callbacks.set(map_id, resolve);
      });
      _promises.set(map_id, p);
    }
    map = await p;
  }
  return map;
}
async function update_map(map_id, initial_position, options) {
  const l = await setup();
  _deleted.delete(map_id);
  async function waitForContainer(id) {
    let el = document.getElementById(id);
    let tries = 0;
    while (!el && tries < 50) {
      await wait(20);
      tries += 1;
      el = document.getElementById(id);
    }
    return el;
  }
  await waitForContainer(`dioxus-leaflet-map-${map_id}`);
  const map = _maps.get(map_id) ?? l.map(`dioxus-leaflet-map-${map_id}`, {
    zoomControl: options.zoom_control,
    scrollWheelZoom: options.scroll_wheel_zoom,
    doubleClickZoom: options.double_click_zoom,
    touchZoom: options.touch_zoom,
    dragging: options.dragging,
    keyboard: options.keyboard,
    attributionControl: options.attribution_control
  });
  map.setView(initial_position.coordinates, initial_position.zoom);
  if (!_tile_layers.has(map_id)) {
    const layer = l.tileLayer(options.tile_layer.url, {
      attribution: options.tile_layer.attribution,
      maxZoom: options.tile_layer.max_zoom,
      subdomains: options.tile_layer.subdomains
    }).addTo(map);
    _tile_layers.set(map_id, layer);
  }
  _maps.set(map_id, map);
  if (_callbacks.has(map_id)) {
    const callback = _callbacks.get(map_id);
    callback(map);
    _callbacks.delete(map_id);
    _promises.delete(map_id);
  }
  await wait(100);
  map.invalidateSize();
  void flush_pending_markers(map_id);
}
function delete_map(map_id) {
  try {
    clear_popups(map_id);
  } catch {
  }
  void clear_markers(map_id);
  void clear_polygons(map_id);
  clear_pending_markers(map_id);
  const map = _maps.get(map_id);
  if (map) {
    try {
      map.off();
    } catch {
    }
  }
  _maps.delete(map_id);
  _tile_layers.delete(map_id);
  _callbacks.delete(map_id);
  _promises.delete(map_id);
  _deleted.add(map_id);
}
async function on_map_click(map_id, callback) {
  await setup();
  const map = await get_map(map_id);
  if (!map) {
    throw new Error(`Map with id ${map_id} not found when setting onClick handler`);
  }
  map.on("click", async (e) => {
    try {
      await callback([e.latlng.lat, e.latlng.lng]);
    } catch (error) {
      console.error("Error in on_map_click callback:", error);
    }
  });
}
async function on_map_move(map_id, callback) {
  await setup();
  const map = await get_map(map_id);
  if (!map) {
    throw new Error(`Map with id ${map_id} not found when setting onMove handler`);
  }
  map.on("move", async () => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    try {
      await callback([center.lat, center.lng, zoom]);
    } catch (error) {
      console.error("Error in map_on_move callback:", error);
    }
  });
}
export {
  clear_markers,
  clear_pending_markers,
  clear_polygons,
  clear_popups,
  delete_map,
  delete_marker,
  delete_polygon,
  flush_pending_markers,
  get_map,
  get_marker,
  get_polygon,
  get_popup,
  on_map_click,
  on_map_move,
  set_markers,
  update_map,
  update_marker,
  update_polygon,
  update_popup
};
