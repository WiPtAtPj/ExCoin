// 로그인 처리 (수정본)
  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg('확인 중...');

    // .single() 대신 일반 select 사용으로 에러 튕김 방지
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
  };
