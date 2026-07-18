import { Outlet, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
// @ts-ignore
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
    solar.getFestivals().forEach((f: string) => festivals.push(f));
    
    // Add lunar festivals
    lunar.getFestivals().forEach((f: string) => festivals.push(f));
    
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
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            transform: 'rotate(2deg)',
            backgroundColor: 'white',
            border: '2px solid var(--crayon-dark)',
            borderRadius: '5px',
            boxShadow: '3px 3px 0px rgba(0,0,0,0.15)',
            width: '120px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Calendar Header / Binder */}
            <div style={{ 
              backgroundColor: 'var(--crayon-red)', 
              color: 'white', 
              width: '100%', 
              textAlign: 'center', 
              padding: '5px 0',
              fontWeight: 'bold',
              fontSize: '1rem',
              borderBottom: '2px dashed var(--crayon-dark)'
            }}>
              {dateInfo.dateStr.split('-')[0]} 年 {dateInfo.dateStr.split('-')[1]} 月
            </div>
            
            {/* Binder Rings (Decorative) */}
            <div style={{ position: 'absolute', top: '5px', left: '20px', width: '8px', height: '15px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '4px' }}></div>
            <div style={{ position: 'absolute', top: '5px', right: '20px', width: '8px', height: '15px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '4px' }}></div>
            
            {/* Large Day Number */}
            <div style={{ 
              fontSize: '3rem', 
              fontWeight: 'bold', 
              color: 'var(--crayon-dark)',
              margin: '5px 0',
              fontFamily: 'Caveat, cursive',
              lineHeight: '1'
            }}>
              {dateInfo.dateStr.split('-')[2]}
            </div>
            
            {/* Weekday */}
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px' }}>
              {dateInfo.weekStr}
            </div>

            {/* Festivals */}
            {dateInfo.festivals.length > 0 && (
              <div style={{ 
                width: '100%',
                backgroundColor: '#fff9c4',
                color: 'var(--crayon-red)', 
                fontWeight: 'bold',
                fontSize: '0.85rem',
                textAlign: 'center',
                padding: '2px 0',
                borderTop: '1px dashed #ccc'
              }}>
                {dateInfo.festivals.join('、')}
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
