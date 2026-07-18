import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

function IncidentMap({ incident }) {
  const coordinates =
    incident.location?.coordinates?.coordinates;

  if (!coordinates || coordinates.length !== 2) {
    return <p>Map location unavailable.</p>;
  }

  const [longitude, latitude] = coordinates;

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      style={{
        height: "350px",
        width: "100%",
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker position={[latitude, longitude]}>
        <Popup>
          <strong>{incident.title}</strong>

          <br />

          {incident.location.address}
        </Popup>
      </Marker>
    </MapContainer>
  );
}

export default IncidentMap;