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
import Materials from './pages/Materials';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SystemManagement from './pages/SystemManagement';
import CalendarManagement from './pages/CalendarManagement';
import type { ModulePermissions } from './types';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const ModuleRouteGuard = ({
  module,
  label,
  children
}: {
  module: keyof ModulePermissions;
  label: string;
  children: React.ReactNode;
}) => {
  const { hasPermission } = useAuth();
  if (!hasPermission(module, 'view')) {
    return (
      <div
        className="doodle-border"
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#fff',
          marginTop: '20px'
        }}
      >
        <h2 style={{ color: 'var(--crayon-red)', marginTop: 0 }}>
          🚫 無權限存取「{label}」功能
        </h2>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          您的帳號目前未被授權檢視此頁面，請聯絡系統管理員調整功能權限設定。
        </p>
      </div>
    );
  }
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<ModuleRouteGuard module="dashboard" label="儀表板"><Dashboard /></ModuleRouteGuard>} />
            <Route path="tasks" element={<ModuleRouteGuard module="tasks" label="盤點任務"><InventoryTasks /></ModuleRouteGuard>} />
            <Route path="dispatch" element={<ModuleRouteGuard module="dispatch" label="盤點單派送"><DispatchTickets /></ModuleRouteGuard>} />
            <Route path="tickets" element={<ModuleRouteGuard module="tickets" label="盤點單管理"><InventoryTickets /></ModuleRouteGuard>} />
            <Route path="additional-tickets" element={<ModuleRouteGuard module="tickets" label="追加盤點"><AdditionalTickets /></ModuleRouteGuard>} />
            <Route path="workflow-tickets" element={<ModuleRouteGuard module="workflowTickets" label="盤點單流程"><WorkflowTickets /></ModuleRouteGuard>} />
            <Route path="workflow" element={<ModuleRouteGuard module="workflow" label="流程管理"><WorkflowManagement /></ModuleRouteGuard>} />
            <Route path="materials" element={<ModuleRouteGuard module="materials" label="物料庫存"><Materials /></ModuleRouteGuard>} />
            <Route path="item-details" element={<ModuleRouteGuard module="itemDetails" label="盤點項目明細"><ItemDetails /></ModuleRouteGuard>} />
            <Route path="personnel" element={<ModuleRouteGuard module="personnel" label="人員管理"><Personnel /></ModuleRouteGuard>} />
            <Route path="statistics" element={<ModuleRouteGuard module="statistics" label="統計作業"><Statistics /></ModuleRouteGuard>} />
            <Route path="calendar" element={<ModuleRouteGuard module="calendar" label="行事曆"><CalendarManagement /></ModuleRouteGuard>} />
            <Route path="system" element={<ModuleRouteGuard module="system" label="系統管理"><SystemManagement /></ModuleRouteGuard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
