import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

function IncidentMap({ incident }) {
  const coordinates = incident.location?.coordinates?.coordinates;

  if (!coordinates || coordinates.length !== 2) {
    return <div className="empty-wrap" style={{ padding: "20px" }}>Location coordinate details unavailable.</div>;
  }

  const [longitude, latitude] = coordinates;

  return (
    <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        style={{
          height: "300px",
          width: "100%",
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <Marker position={[latitude, longitude]}>
          <Popup>
            <div style={{ color: "#000" }}>
              <strong>{incident.title}</strong>
              <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>{incident.location.address}</div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

export default IncidentMap;