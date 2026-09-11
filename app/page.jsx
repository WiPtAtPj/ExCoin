'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

export default function Home() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('login'); // login, reset, dashboard, admin
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  // 비밀번호 재설정용 상태
  const [resetId, setResetId] = useState('');
  const [resetCard, setResetCard] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAuthOk, setIsAuthOk] = useState(false);

  // 최초 로그인 시 비번 변경 팝업
  const [mustChange, setMustChange] = useState(false);
  const [firstNewPw, setFirstNewPw] = useState('');

  // 데이터 상태
  const [budgetData, setBudgetData] = useState(null);
  const [adminAllData, setAdminAllData] = useState([]);

  // 로그인 처리 (안전한 배열 조회 방식)
  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg('확인 중...');

    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('login_id', loginId.trim());

      if (error) {
        setMsg(`[DB 접속 오류] ${error.message}`);
        return;
      }

      if (!users || users.length === 0) {
        setMsg('해당 아이디(사번)를 찾을 수 없습니다.');
        return;
      }

      const user = users[0];

      if (user.password_hash !== password.trim()) {
        setMsg('비밀번호가 일치하지 않습니다.');
        return;
      }

      setSession(user);
      setMsg('');

      if (user.must_change_password) {
        setMustChange(true);
        return;
      }

      if (user.role === 'admin') {
        setView('admin');
        fetchAdminData();
      } else {
        setView('dashboard');
        fetchUserBudget(user.login_id);
      }
    } catch (err) {
      setMsg(`[시스템 오류] ${err.message}`);
    }
  };

  // 최초 로그인 비번 변경
  const handleFirstPasswordChange = async () => {
    if (!firstNewPw || firstNewPw.length < 6) {
      alert('비밀번호는 최소 6자리 이상 입력해주세요.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ password_hash: firstNewPw, must_change_password: false })
      .eq('login_id', session.login_id);

    if (error) {
      alert('변경 실패: ' + error.message);
      return;
    }
    alert('비밀번호가 안전하게 변경되었습니다.');
    setMustChange(false);
    if (session.role === 'admin') {
      setView('admin');
      fetchAdminData();
    } else {
      setView('dashboard');
      fetchUserBudget(session.login_id);
    }
  };

  // 비밀번호 찾기 (카드 뒷 4자리 인증)
  const handleVerifyCard = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('login_id', resetId.trim())
      .eq('card_last4', resetCard.trim());

    if (error || !data || data.length === 0) {
      alert('아이디와 카드 뒷 4자리 정보가 일치하지 않습니다.');
      return;
    }
    setIsAuthOk(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('새 비밀번호를 6자리 이상 입력해주세요.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ password_hash: newPassword, must_change_password: false })
      .eq('login_id', resetId.trim());

    if (error) {
      alert('오류 발생: ' + error.message);
      return;
    }
    alert('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.');
    setView('login');
    setIsAuthOk(false);
    setResetId('');
    setResetCard('');
    setNewPassword('');
  };

  // 일반 직원 데이터 조회
  const fetchUserBudget = async (id) => {
    const { data } = await supabase
      .from('executive_budgets')
      .select('*')
      .eq('login_id', id);
    
    if (data && data.length > 0) {
      setBudgetData(data[0]);
    }
  };

  // 관리자 전체 데이터 조회
  const fetchAdminData = async () => {
    const { data } = await supabase.from('executive_budgets').select('*');
    setAdminAllData(data || []);
  };

  // 관리자 엑셀 업로드 처리 (DB.xlsx 파싱)
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const dataRows = rows.slice(1);
        // WH로 시작하는 유효 직원 행만 추출
        const validRows = dataRows.filter((r) => r[0] && String(r[0]).startsWith('WH'));

        for (const r of validRows) {
          const id = String(r[0]).trim();
          const initPw = String(r[1] || 'wisdom123!@#').trim();
          const cardFull = String(r[2] || '').trim();
          const cardLast4 = cardFull ? cardFull.replace(/[^0-9]/g, '').slice(-4) : '0000';
          const name = String(r[3] || '').trim();

          const prevRem = parseFloat(r[4]) || 0;
          const baseBud = parseFloat(r[5]) || 0;
          const finalGrant = parseFloat(r[6]) || (prevRem + baseBud);

          // 월별 사용액 (4월 ~ 3월)
          const m04 = parseFloat(r[7]) || 0;
          const m05 = parseFloat(r[8]) || 0;
          const m06 = parseFloat(r[9]) || 0;
          const m07 = parseFloat(r[10]) || 0;
          const m08 = parseFloat(r[11]) || 0;
          const m09 = parseFloat(r[12]) || 0;
          const m10 = parseFloat(r[13]) || 0;
          const m11 = parseFloat(r[14]) || 0;
          const m12 = parseFloat(r[15]) || 0;
          const m01 = parseFloat(r[16]) || 0;
          const m02 = parseFloat(r[17]) || 0;
          const m03 = parseFloat(r[18]) || 0;

          const totalSpent = m04 + m05 + m06 + m07 + m08 + m09 + m10 + m11 + m12 + m01 + m02 + m03;
          const finalRem = finalGrant - totalSpent;

          // 1. 프로필 생성 (이미 있으면 비번 건너뜀)
          await supabase.from('profiles').upsert(
            {
              login_id: id,
              password_hash: initPw,
              name: name,
              card_full: cardFull,
              card_last4: cardLast4,
              role: 'employee'
            },
            { onConflict: 'login_id', ignoreDuplicates: true }
          );

          // 2. 예산 데이터 갱신
          await supabase.from('executive_budgets').upsert(
            {
              login_id: id,
              fiscal_year: '2026-2027',
              prev_remaining: prevRem,
              base_budget: baseBud,
              final_granted_budget: finalGrant,
              m_04: m04, m_05: m05, m_06: m06, m_07: m07, m_08: m08, m_09: m09,
              m_10: m10, m_11: m11, m_12: m12, m_01: m01, m_02: m02, m_03: m03,
              accumulated_spent: totalSpent,
              final_remaining: finalRem
            },
            { onConflict: 'login_id' }
          );
        }

        alert('DB.xlsx 파일이 성공적으로 동기화되었습니다!');
        fetchAdminData();
      } catch (uploadErr) {
        alert('엑셀 처리 중 오류: ' + uploadErr.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 엑셀 다운로드
  const downloadMyExcel = () => {
    if (!budgetData) return;
    const exportData = [
      {
        '사번': session.login_id,
        '성명': session.name,
        '최종 부여예산': budgetData.final_granted_budget,
        '누적 사용금액': budgetData.accumulated_spent,
        '최종 잔여예산': budgetData.final_remaining,
        '4월': budgetData.m_04, '5월': budgetData.m_05, '6월': budgetData.m_06,
        '7월': budgetData.m_07, '8월': budgetData.m_08, '9월': budgetData.m_09,
        '10월': budgetData.m_10, '11월': budgetData.m_11, '12월': budgetData.m_12,
        '1월': budgetData.m_01, '2월': budgetData.m_02, '3월': budgetData.m_03,
      }
    ];
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "내예산내역");
    XLSX.writeFile(wb, `${session.name}_예산내역.xlsx`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'sans-serif', padding: '24px' }}>
      {/* 팝업: 최초 비번 변경 */}
      {mustChange && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 28, borderRadius: 12, width: 360, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px' }}>🔒 새 비밀번호 설정</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>첫 로그인입니다. 안전한 사용을 위해 새 비밀번호를 설정해 주세요.</p>
            <input
              type="password"
              placeholder="새 비밀번호 입력"
              value={firstNewPw}
              onChange={(e) => setFirstNewPw(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 14, boxSizing: 'border-box' }}
            />
            <button
              onClick={handleFirstPasswordChange}
              style={{ width: '100%', padding: 10, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}
            >
              변경 완료 및 시작
            </button>
          </div>
        </div>
      )}

      {/* 1. 로그인 뷰 */}
      {view === 'login' && (
        <div style={{ maxWidth: 380, margin: '60px auto', background: '#fff', padding: 32, borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 6px', color: '#1e293b' }}>위즈덤하우스</h2>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>임원 예산 조회 시스템</p>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#475569' }}>아이디 (사번)</label>
              <input
                type="text"
                placeholder="예: WH10049"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, marginTop: 4, boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 'bold', color: '#475569' }}>비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, marginTop: 4, boxSizing: 'border-box' }}
                required
              />
            </div>
            {msg && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 12px' }}>{msg}</p>}
            <button
              type="submit"
              style={{ width: '100%', padding: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
            >
              로그인
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => setView('reset')}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
            >
              비밀번호를 잊으셨나요? (카드 인증)
            </button>
          </div>
        </div>
      )}

      {/* 2. 비밀번호 재설정 뷰 */}
      {view === 'reset' && (
        <div style={{ maxWidth: 380, margin: '60px auto', background: '#fff', padding: 32, borderRadius: 14 }}>
          <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>비밀번호 재설정</h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>사번과 본인 법인카드 뒷 4자리로 인증합니다.</p>
          {!isAuthOk ? (
            <>
              <input
                type="text"
                placeholder="아이디(사번)"
                value={resetId}
                onChange={(e) => setResetId(e.target.value)}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="카드번호 끝 4자리"
                maxLength={4}
                value={resetCard}
                onChange={(e) => setResetCard(e.target.value)}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 14, boxSizing: 'border-box' }}
              />
              <button
                onClick={handleVerifyCard}
                style={{ width: '100%', padding: 10, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
              >
                본인 인증 확인
              </button>
            </>
          ) : (
            <>
              <input
                type="password"
                placeholder="새 비밀번호 입력"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 14, boxSizing: 'border-box' }}
              />
              <button
                onClick={handleResetPassword}
                style={{ width: '100%', padding: 10, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
              >
                새 비밀번호 저장
              </button>
            </>
          )}
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button
              onClick={() => setView('login')}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}
            >
              로그인 화면으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 3. 직원 전용 대시보드 뷰 */}
      {view === 'dashboard' && budgetData && (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, color: '#0f172a' }}>{session.name} 님 예산 현황</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>회계연도: 2026년 4월 ~ 2027년 3월</p>
            </div>
            <div>
              <button
                onClick={downloadMyExcel}
                style={{ padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', marginRight: 8 }}
              >
                📥 엑셀 다운로드
              </button>
              <button
                onClick={() => { setSession(null); setView('login'); }}
                style={{ padding: '8px 14px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}
              >
                로그아웃
              </button>
            </div>
          </div>

          {/* 3대 요약 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>최종 부여 예산</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginTop: 6 }}>
                {Math.round(budgetData.final_granted_budget).toLocaleString()} 원
              </div>
            </div>
            <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>누적 사용 금액</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ef4444', marginTop: 6 }}>
                {Math.round(budgetData.accumulated_spent).toLocaleString()} 원
              </div>
            </div>
            <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>최종 잔여 예산</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#2563eb', marginTop: 6 }}>
                {Math.round(budgetData.final_remaining).toLocaleString()} 원
              </div>
            </div>
          </div>

          {/* 월별 내역 테이블 */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 14 }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                <tr>
                  <th style={{ padding: 12, textAlign: 'left' }}>구분</th>
                  <th>4월</th><th>5월</th><th>6월</th><th>7월</th><th>8월</th><th>9월</th>
                  <th>10월</th><th>11월</th><th>12월</th><th>1월</th><th>2월</th><th>3월</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>사용액</td>
                  <td>{Math.round(budgetData.m_04).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_05).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_06).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_07).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_08).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_09).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_10).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_11).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_12).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_01).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_02).toLocaleString()}</td>
                  <td>{Math.round(budgetData.m_03).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. 관리자 전용 뷰 */}
      {view === 'admin' && (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2>🛠️ 시스템 관리자 대시보드</h2>
            <button
              onClick={() => { setSession(null); setView('login'); }}
              style={{ padding: '8px 14px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}
            >
              로그아웃
            </button>
          </div>

          <div style={{ background: '#fff', padding: 24, borderRadius: 10, border: '2px dashed #94a3b8', textAlign: 'center', marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 6px' }}>📂 매월 DB.xlsx 파일 업로드</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
              첨부해주신 <code>DB.xlsx</code> 파일을 업로드하면 전 직원의 예산과 신규 계정이 자동 동기화됩니다.
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />
          </div>

          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
            <h4>전체 등록 현황 ({adminAllData.length}명)</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'right' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: 8, textAlign: 'left' }}>사번</th>
                  <th>부여예산</th><th>누적사용</th><th>최종잔여</th>
                </tr>
              </thead>
              <tbody>
                {adminAllData.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 8, textAlign: 'left', fontWeight: 'bold' }}>{d.login_id}</td>
                    <td>{Math.round(d.final_granted_budget).toLocaleString()}</td>
                    <td style={{ color: '#ef4444' }}>{Math.round(d.accumulated_spent).toLocaleString()}</td>
                    <td style={{ color: '#2563eb', fontWeight: 'bold' }}>{Math.round(d.final_remaining).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
