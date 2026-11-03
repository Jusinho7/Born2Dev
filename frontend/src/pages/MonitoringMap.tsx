import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { Localized } from "../contexts/LanguageContext";

type Region = {
  name: string;
  article_count: number;
  coordinates: [number, number];
};

type MonitoringMapProps = {
  regions: Region[];
  onRegionSelect: (region: string) => void;
};

const MonitoringMap = ({ regions, onRegionSelect }: MonitoringMapProps) => (
  <Localized>
  <MapContainer center={[-19.2, 46.7]} zoom={5} scrollWheelZoom={false} className="monitor-leaflet-map">
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    {regions.map((region) => (
      <CircleMarker
        key={region.name}
        center={region.coordinates as LatLngExpression}
        radius={Math.min(16, 5 + Math.sqrt(region.article_count) * 2)}
        pathOptions={{
          color: region.article_count ? "#11663c" : "#c28b34",
          fillColor: region.article_count ? "#39a66c" : "#e4bd70",
          fillOpacity: 0.7,
        }}
        eventHandlers={{ click: () => onRegionSelect(region.name) }}
      >
        <Popup><strong>{region.name}</strong><br />{region.article_count} article(s) attribué(s)</Popup>
      </CircleMarker>
    ))}
  </MapContainer>
  </Localized>
);

export default MonitoringMap;
