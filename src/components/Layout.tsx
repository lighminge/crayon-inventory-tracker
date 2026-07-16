import { Outlet, NavLink } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app-container">
      <header style={{ padding: '20px 0', borderBottom: '3px solid var(--crayon-dark)' }}>
        <h1 style={{ textAlign: 'center' }}>🖍️ 塗鴉風盤點派發管理系統</h1>
      </header>
      
      <div className="layout">
        <aside className="sidebar doodle-border">
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <NavLink to="/" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              📊 儀表板
            </NavLink>
            <NavLink to="/personnel" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              👥 人員管理
            </NavLink>
            <NavLink to="/tickets" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              📝 盤點單管理
            </NavLink>
          </nav>
          <div style={{ marginTop: 'auto' }}>
            <button className="doodle-button danger" style={{ width: '100%' }}>登出</button>
          </div>
        </aside>
        
        <main className="main-content doodle-border">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
