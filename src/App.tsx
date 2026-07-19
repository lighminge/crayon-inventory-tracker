import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Personnel from './pages/Personnel';
import InventoryTickets from './pages/InventoryTickets';
import DispatchTickets from './pages/DispatchTickets';
import WorkflowManagement from './pages/WorkflowManagement';
import Statistics from './pages/Statistics';
import Login from './pages/Login';
import InventoryTasks from './pages/InventoryTasks';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<InventoryTasks />} />
          <Route path="dispatch" element={<DispatchTickets />} />
          <Route path="tickets" element={<InventoryTickets />} />
          <Route path="workflow" element={<WorkflowManagement />} />
          <Route path="personnel" element={<Personnel />} />
          <Route path="statistics" element={<Statistics />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
