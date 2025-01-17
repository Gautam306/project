import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Entry from './Pages/Entry';
import Map from './Pages/Map';
import VideoFrame from './Pages/Frame';
import VideoCall from './Components/VideoCall';
import { SocketProvider } from './ContextApi/SocketProvider';

function App() {
  return (
    <SocketProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Entry />} />
          <Route path="/city-map" element={<VideoFrame />} />
          <Route path="/connected" element={<VideoCall />} />
        </Routes>
      </Router>
    </SocketProvider>
  );
}

export default App;
