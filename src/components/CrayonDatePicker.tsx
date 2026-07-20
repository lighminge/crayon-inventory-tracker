import { useState, useRef, useEffect } from 'react';

interface CrayonDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function CrayonDatePicker({ value, onChange, placeholder = '選擇日期' }: CrayonDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update current month when value changes
  useEffect(() => {
    if (value && !isOpen) {
      const d = new Date(value);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value, isOpen]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Adjust for local timezone offset to get correct YYYY-MM-DD
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 10);
    onChange(localISOTime);
    setIsOpen(false);
  };

  // Calendar logic
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <div 
        className="doodle-input" 
        style={{ 
          cursor: 'pointer', 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'white'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ color: value ? '#000' : '#888' }}>{value || placeholder}</span>
        <span>📅</span>
      </div>

      {isOpen && (
        <div 
          className="doodle-border"
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            zIndex: 1000,
            backgroundColor: 'var(--crayon-paper)',
            padding: '15px',
            width: '260px',
            boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <button 
              className="doodle-button" 
              style={{ padding: '2px 8px', minHeight: '30px', fontSize: '1rem' }} 
              onClick={(e) => { e.preventDefault(); handlePrevMonth(); }}
            >
              &lt;
            </button>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-blue)' }}>
              {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
            </div>
            <button 
              className="doodle-button" 
              style={{ padding: '2px 8px', minHeight: '30px', fontSize: '1rem' }} 
              onClick={(e) => { e.preventDefault(); handleNextMonth(); }}
            >
              &gt;
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center', marginBottom: '5px' }}>
            {weekDays.map(wd => (
              <div key={wd} style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--crayon-dark)' }}>{wd}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              
              const currentDateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = value === currentDateStr;
              const isToday = new Date().toISOString().split('T')[0] === currentDateStr;

              return (
                <div 
                  key={day}
                  onClick={() => handleDateClick(day)}
                  style={{
                    padding: '8px 0',
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    backgroundColor: isSelected ? 'var(--crayon-orange)' : (isToday ? '#ffecb3' : 'transparent'),
                    color: isSelected ? 'white' : 'black',
                    border: isSelected ? '2px dashed var(--crayon-dark)' : (isToday ? '1px dashed #ccc' : '1px solid transparent'),
                    transition: 'all 0.2s',
                    fontSize: '0.95rem'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = isToday ? '#ffecb3' : 'transparent';
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
             <button 
                className="doodle-button danger" 
                style={{ padding: '4px 10px', fontSize: '0.85rem', minHeight: '28px' }}
                onClick={(e) => { e.preventDefault(); onChange(''); setIsOpen(false); }}
             >
               清除日期
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
