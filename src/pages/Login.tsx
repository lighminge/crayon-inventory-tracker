export default function Login() {
  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <div className="doodle-border" style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
        <h2>登入 (Login)</h2>
        <p>此系統僅限管理者使用</p>
        <div style={{ marginTop: '20px' }}>
          <input className="doodle-input" type="email" placeholder="Email" style={{ marginBottom: '10px' }} />
          <input className="doodle-input" type="password" placeholder="密碼" style={{ marginBottom: '20px' }} />
          <button className="doodle-button" style={{ width: '100%' }}>登入</button>
        </div>
      </div>
    </div>
  );
}
