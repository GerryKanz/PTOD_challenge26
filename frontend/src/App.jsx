import {useStationFacilities} from './hooks/useStationData';

function App() {
    const {data, isLoading, error} = useStationFacilities('odpt.Operator:JR-East');
    if (isLoading) return <p>Loading station facilities...</p>;
        if (error) return <p>Error: {error.message}</p>;

        return (
            <div style={{padding: '20px'}}>
                <h1>Low-Burden Accessibility Data</h1>
      <p>Raw ODPT response for JR-East facilities:</p>
      {/* This <pre> tag formats the JSON so it's easy to read! */}
      <pre style={{ background: '#f4f4f4', padding: '15px' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
        );
    }
export default App;
