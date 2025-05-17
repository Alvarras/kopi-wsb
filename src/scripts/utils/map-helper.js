import L from "leaflet";

export class MapHelper {
  constructor() {
    this.maps = {};
    this.markers = {};
    this.selectedLocation = null;
    this.layerGroups = {};
  }

  initMap(containerId, isSelectable = false) {
    if (this.maps[containerId]) return this.maps[containerId].map;

    // Create map instance
    const map = L.map(containerId, {
      zoomControl: true,
      attributionControl: true,
    }).setView([-7.3616, 109.9029], 13); // Wonosobo coordinates

    // Add standard tile layer (OpenStreetMap)
    const standardLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    ).addTo(map);

    // Add satellite tile layer (ESRI World Imagery)
    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxZoom: 19,
      }
    );

    // Add topographic layer (OpenTopoMap)
    const topoLayer = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        attribution:
          'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
        maxZoom: 17,
      }
    );

    // Create layer control
    const baseLayers = {
      Standar: standardLayer,
      Satelit: satelliteLayer,
      Topografi: topoLayer,
    };

    // Create a layer group for markers
    this.layerGroups[containerId] = L.layerGroup().addTo(map);

    const overlays = {
      Markers: this.layerGroups[containerId],
    };

    // Add layer control to map
    L.control.layers(baseLayers, overlays).addTo(map);

    // Add scale control
    L.control.scale({ imperial: false, metric: true }).addTo(map);

    // Store map instance
    this.maps[containerId] = {
      map,
      layers: {
        standard: standardLayer,
        satellite: satelliteLayer,
        topo: topoLayer,
      },
    };

    // Initialize markers array for this map
    this.markers[containerId] = [];

    // Add click handler for selectable maps
    if (isSelectable) {
      map.on("click", (e) => {
        this.handleMapClick(containerId, e);
      });
    }

    // Make map responsive
    this.makeMapResponsive(map, containerId);

    return map;
  }

  makeMapResponsive(map, containerId) {
    // Handle window resize events
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    const container = document.getElementById(containerId);
    if (container) {
      resizeObserver.observe(container);
    }

    // Handle orientation change on mobile
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    });
  }

  handleMapClick(containerId, e) {
    const { lat, lng } = e.latlng;

    // Clear previous marker
    if (this.selectedLocation) {
      this.maps[containerId].map.removeLayer(this.selectedLocation);
    }

    // Add new marker
    this.selectedLocation = L.marker([lat, lng], {
      draggable: true, // Make marker draggable
      autoPan: true, // Pan map when dragging near the edge
    }).addTo(this.maps[containerId].map);

    // Add popup to the marker
    this.selectedLocation
      .bindPopup(
        `<b>Lokasi Terpilih</b><br>Latitude: ${lat.toFixed(
          6
        )}<br>Longitude: ${lng.toFixed(6)}`
      )
      .openPopup();

    // Update when marker is dragged
    this.selectedLocation.on("dragend", (event) => {
      const marker = event.target;
      const position = marker.getLatLng();
      marker.setPopupContent(
        `<b>Lokasi Terpilih</b><br>Latitude: ${position.lat.toFixed(
          6
        )}<br>Longitude: ${position.lng.toFixed(6)}`
      );

      // Update form fields
      document.getElementById("story-lat").value = position.lat;
      document.getElementById("story-lon").value = position.lng;
      document.getElementById(
        "selected-location"
      ).textContent = `Lokasi dipilih: ${position.lat.toFixed(
        4
      )}, ${position.lng.toFixed(4)}`;
    });

    // Update form fields
    document.getElementById("story-lat").value = lat;
    document.getElementById("story-lon").value = lng;
    document.getElementById(
      "selected-location"
    ).textContent = `Lokasi dipilih: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  isMapInitialized(containerId) {
    return !!this.maps[containerId];
  }

  setMapLayer(layerName) {
    // Set layer for all maps
    Object.keys(this.maps).forEach((containerId) => {
      const mapObj = this.maps[containerId];

      // Remove all layers
      Object.values(mapObj.layers).forEach((layer) => {
        mapObj.map.removeLayer(layer);
      });

      // Add selected layer
      if (mapObj.layers[layerName]) {
        mapObj.layers[layerName].addTo(mapObj.map);
      }
    });

    // Update UI
    document.querySelectorAll(".map-layers button").forEach((button) => {
      button.classList.remove("active");
    });

    document.getElementById(`map-${layerName}`).classList.add("active");
  }

  addMarker(lat, lng, title, popupContent) {
    // Add marker to stories map
    if (!this.maps["stories-map"]) return;

    const marker = L.marker([lat, lng]).addTo(this.layerGroups["stories-map"]);

    if (popupContent) {
      marker.bindPopup(popupContent);
    }

    this.markers["stories-map"].push(marker);

    return marker;
  }

  clearMarkers(containerId) {
    if (!this.markers[containerId]) return;

    this.markers[containerId].forEach((marker) => {
      this.maps[containerId].map.removeLayer(marker);
    });

    this.markers[containerId] = [];
  }

  // Add cluster markers for better performance with many points
  addMarkerClusters(containerId) {
    if (!this.maps[containerId] || !L.markerClusterGroup) return;

    // Create a marker cluster group
    const markers = L.markerClusterGroup();

    // Add all existing markers to the cluster
    this.markers[containerId].forEach((marker) => {
      markers.addLayer(marker);
    });

    // Add the cluster group to the map
    this.maps[containerId].map.addLayer(markers);

    return markers;
  }

  // Fit map to show all markers
  fitMapToMarkers(containerId) {
    if (!this.maps[containerId] || this.markers[containerId].length === 0)
      return;

    const group = new L.featureGroup(this.markers[containerId]);
    this.maps[containerId].map.fitBounds(group.getBounds(), {
      padding: [50, 50],
    });
  }
}
