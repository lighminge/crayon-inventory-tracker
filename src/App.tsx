import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Personnel from './pages/Personnel';
import InventoryTickets from './pages/InventoryTickets';
import AdditionalTickets from './pages/AdditionalTickets';
import DispatchTickets from './pages/DispatchTickets';
import WorkflowManagement from './pages/WorkflowManagement';
import WorkflowTickets from './pages/WorkflowTickets';
import Statistics from './pages/Statistics';
import Login from './pages/Login';
import InventoryTasks from './pages/InventoryTasks';
import ItemDetails from './pages/ItemDetails';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import SystemManagement from './pages/SystemManagement';
import CalendarManagement from './pages/CalendarManagement';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <GoogleReCaptchaProvider reCaptchaKey="6LdsdKMtAAAAAAdj6iEMvolYa19W8FuZxE9KNFoe">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<InventoryTasks />} />
          <Route path="dispatch" element={<DispatchTickets />} />
          <Route path="tickets" element={<InventoryTickets />} />
          <Route path="additional-tickets" element={<AdditionalTickets />} />
          <Route path="workflow-tickets" element={<WorkflowTickets />} />
          <Route path="workflow" element={<WorkflowManagement />} />
          <Route path="item-details" element={<ItemDetails />} />
          <Route path="personnel" element={<Personnel />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="calendar" element={<CalendarManagement />} />
          <Route path="system" element={<SystemManagement />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
      </GoogleReCaptchaProvider>
    </AuthProvider>
  );
}

export default App;
