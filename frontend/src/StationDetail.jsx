import React from 'react';
import { useStationCongestion } from './hooks/useOverpassStation';

export default function StationDetail({ operator, name }) {
  const stationKey = (name || 'tokyo').toLowerCase();
  const { data: station, isLoading, error } = useStationCongestion(stationKey);

  if (isLoading) return <p>Loading {name}...</p>;
  if (error || !station) return <p>Could not load {name}.</p>;

  const { congestion } = station;

  return (
    <section>
      <h2>{station.name.en} ({station.name.ja})</h2>
      <p>{station.operator?.name || operator}</p>

      <h3>Congestion</h3>
      <ul>
        <li>Busy level: {congestion.busy_level}</li>
        <li>Passengers per day: {congestion.passengers_per_day.toLocaleString()} ({congestion.survey_year || 2024} survey)</li>
        <li>Live delay: {congestion.live_delay_minutes ?? '0'} min</li>
      </ul>

      <h3>Line status</h3>
      <ul>
        {station.service_status.map((line) => (
          <li key={line.railway}>{line.railway.split('.').pop()}: {line.text || line.status}</li>
        ))}
      </ul>
    </section>
  );
}