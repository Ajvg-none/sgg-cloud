import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StoreWarranty from './pages/StoreWarranty';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StoreWarranty />} />
      </Routes>
    </Router>
  );
}

export default App;