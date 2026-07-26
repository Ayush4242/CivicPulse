import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
    },
  });

  if (!position) {
    return null;
  }

  return (
    <Marker
      position={[
        position.latitude,
        position.longitude,
      ]}
    />
  );
}

function LocationPicker({ position, setPosition }) {
  const defaultPosition = [20.5937, 78.9629];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <span className="form-label" style={{ display: "block" }}>
        Select Location on Map
      </span>

      <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
        <MapContainer
          center={
            position
              ? [position.latitude, position.longitude]
              : defaultPosition
          }
          zoom={position ? 16 : 5}
          style={{
            height: "350px",
            width: "100%",
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <LocationMarker
            position={position}
            setPosition={setPosition}
          />
        </MapContainer>
      </div>

      {!position && (
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Click on the map to pinpoint the exact location.
        </span>
      )}
    </div>
  );
}

export default LocationPicker;