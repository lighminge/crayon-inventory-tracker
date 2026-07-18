import { Outlet, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Lunar, Solar } from 'lunar-javascript';

export default function Layout() {
  const [dateInfo, setDateInfo] = useState<{
    dateStr: string;
    weekStr: string;
    festivals: string[];
  } | null>(null);

  useEffect(() => {
    const today = new Date();
    const solar = Solar.fromDate(today);
    const lunar = Lunar.fromDate(today);
    
    const d = solar.toYmd();
    const w = '星期' + solar.getWeekInChinese();
    
    const festivals: string[] = [];
    
    // Add solar festivals
    solar.getFestivals().forEach(f => festivals.push(f));
    
    // Add lunar festivals
    lunar.getFestivals().forEach(f => festivals.push(f));
    
    // Add solar term if exists
    const jieQi = lunar.getJieQi();
    if (jieQi) festivals.push(jieQi);

    setDateInfo({
      dateStr: d,
      weekStr: w,
      festivals
    });
  }, []);

  return (
    <div className="app-container">
      <header style={{ 
        padding: '20px', 
        borderBottom: '3px solid var(--crayon-dark)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <h1 style={{ margin: 0 }}>🖍️ 塗鴉風盤點派發管理系統</h1>
        
        {dateInfo && (
          <div className="doodle-border" style={{ 
            padding: '10px 20px', 
            backgroundColor: '#fff9c4', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            transform: 'rotate(2deg)'
          }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              📅 {dateInfo.dateStr} ({dateInfo.weekStr})
            </div>
            {dateInfo.festivals.length > 0 && (
              <div style={{ 
                marginTop: '5px', 
                color: 'var(--crayon-red)', 
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}>
                🌟 {dateInfo.festivals.join('、')}
              </div>
            )}
          </div>
        )}
      </header>
      
      <div className="layout">
        <aside className="sidebar doodle-border">
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <NavLink to="/" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              📊 儀表板
            </NavLink>
            <NavLink to="/dispatch" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              📤 盤點單派送
            </NavLink>
            <NavLink to="/tickets" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              📝 盤點單管理
            </NavLink>
            <NavLink to="/workflow" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              ⚙️ 流程管理
            </NavLink>
            <NavLink to="/personnel" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              👥 人員管理
            </NavLink>
            <NavLink to="/statistics" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              📈 統計作業
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
