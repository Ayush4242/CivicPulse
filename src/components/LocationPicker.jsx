import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from "react-leaflet";

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
    <div>
      <p>
        Click on the map to mark the exact location of
        the incident.
      </p>

      <MapContainer
        center={
          position
            ? [position.latitude, position.longitude]
            : defaultPosition
        }
        zoom={position ? 16 : 5}
        style={{
          height: "400px",
          width: "100%",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationMarker
          position={position}
          setPosition={setPosition}
        />
      </MapContainer>

      {position && (
        <p>
          Selected coordinates:{" "}
          {position.latitude.toFixed(6)},{" "}
          {position.longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}

export default LocationPicker;