/* =============================================
   ENTRE — 앙트르 메인 스크립트
   ============================================= */

/* --- Sticky Nav --- */
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
  nav.style.background = window.scrollY > 80
    ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0.92)';
});

/* --- Sticky CTA --- */
const stickyCta = document.getElementById('sticky-cta');
const applySection = document.getElementById('apply');
if (applySection && stickyCta) {
  new IntersectionObserver((entries) => {
    entries.forEach(e => stickyCta.classList.toggle('hidden', e.isIntersecting));
  }, { threshold: 0.1 }).observe(applySection);
}

function scrollToApply() {
  document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* --- FAQ 토글 --- */
function toggleFaq(btn) {
  const item   = btn.closest('.faq__item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq__item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

/* --- 리뷰 슬라이더 --- */
let currentReview = 0;
const reviewCards = document.querySelectorAll('.review__card');
const dots        = document.querySelectorAll('.dot');
function setReview(index) {
  reviewCards.forEach((c, i) => c.classList.toggle('active', i === index));
  dots.forEach((d, i)        => d.classList.toggle('active', i === index));
  currentReview = index;
}
if (reviewCards.length > 0) {
  setInterval(() => setReview((currentReview + 1) % reviewCards.length), 4000);
}

/* ==============================================
   날짜 드롭다운 & 잔여석
============================================== */
async function loadSessionDates() {
  const sel        = document.getElementById('date');
  const seatStatus = document.getElementById('seat-status');
  if (!sel) { console.warn('[ENTRE] #date 요소를 찾을 수 없음'); return; }

  console.log('[ENTRE] 세션 일정 불러오는 중...');
  try {
    const res  = await fetch('tables/sessions?limit=200');
    const data = await res.json();
    const today = new Date().toISOString().split('T')[0];

    const sessions = (data.data || [])
      .filter(s => s.is_active !== false && s.date_iso >= today)
      .sort((a, b) => {
        if (a.date_iso !== b.date_iso) return a.date_iso.localeCompare(b.date_iso);
        return a.time_slot.localeCompare(b.time_slot);
      });

    console.log('[ENTRE] 불러온 세션 수:', sessions.length);
    sel.innerHTML = sessions.length === 0
      ? '<option value="">현재 모집 중인 일정이 없습니다</option>'
      : '<option value="">날짜를 선택하세요</option>';

    sessions.forEach(s => {
      const opt      = document.createElement('option');
      opt.value      = s.id;
      const label    = (s.date_label || s.date_iso) + ' ' + s.time_slot;
      opt.dataset.sessionLabel = label;
      opt.dataset.maleCap      = s.male_capacity   || 20;
      opt.dataset.femaleCap    = s.female_capacity || 20;
      opt.dataset.closed       = s.is_closed ? 'true' : 'false';

      if (s.is_closed) {
        opt.textContent = label + ' — 마감';
        opt.disabled    = true;
        opt.style.color = '#555';
      } else {
        opt.textContent = label;
      }
      sel.appendChild(opt);
    });

    sel.addEventListener('change', () => loadSeatStatus(sel, seatStatus));
  } catch (err) {
    console.error('[ENTRE] 세션 일정 불러오기 실패:', err);
    sel.innerHTML = '<option value="">⚠️ 일정을 불러올 수 없습니다</option>';
  }
}

async function loadSeatStatus(sel, seatStatus) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) { seatStatus.style.display = 'none'; return; }

  const sessionId  = opt.value;
  const maleCap    = parseInt(opt.dataset.maleCap)   || 20;
  const femaleCap  = parseInt(opt.dataset.femaleCap) || 20;

  seatStatus.style.display = 'block';
  seatStatus.innerHTML = `<span class="seat-badge" style="color:var(--gray-400);">잔여석 확인 중...</span>`;

  try {
    const res  = await fetch('tables/applications?limit=500');
    const data = await res.json();
    const apps = (data.data || []).filter(a => a.session_id === sessionId && a.status !== '취소');

    const maleCnt    = apps.filter(a => a.gender === '남자').length;
    const femaleCnt  = apps.filter(a => a.gender === '여자').length;
    const maleLeft   = Math.max(0, maleCap   - maleCnt);
    const femaleLeft = Math.max(0, femaleCap - femaleCnt);

    const maleClass   = maleLeft   <= 3 ? 'seat-badge--urgent' : 'seat-badge--male';
    const femaleClass = femaleLeft <= 3 ? 'seat-badge--urgent' : 'seat-badge--female';

    seatStatus.innerHTML = `
      <div class="seat-status__bar">
        <span class="seat-badge ${maleClass}">${maleLeft === 0 ? '남자 마감' : '남자 잔여 ' + maleLeft + '석'}</span>
        <span class="seat-badge ${femaleClass}">${femaleLeft === 0 ? '여자 마감' : '여자 잔여 ' + femaleLeft + '석'}</span>
      </div>
      <div class="seat-progress">
        <div class="seat-progress__item">
          <div class="seat-progress__label"><span>남자</span><span>${maleCnt} / ${maleCap}명</span></div>
          <div class="seat-progress__bar"><div class="seat-progress__fill seat-progress__fill--male" style="width:${Math.min(100, maleCnt/maleCap*100)}%"></div></div>
        </div>
        <div class="seat-progress__item">
          <div class="seat-progress__label"><span>여자</span><span>${femaleCnt} / ${femaleCap}명</span></div>
          <div class="seat-progress__bar"><div class="seat-progress__fill seat-progress__fill--female" style="width:${Math.min(100, femaleCnt/femaleCap*100)}%"></div></div>
        </div>
      </div>
      ${(maleLeft <= 3 && maleLeft > 0) || (femaleLeft <= 3 && femaleLeft > 0)
        ? '<p class="seat-status__warn">마감 임박! 서둘러 신청하세요.</p>' : ''}
    `;
  } catch (err) {
    console.error('[ENTRE] 잔여석 정보 불러오기 실패:', err);
    seatStatus.innerHTML = `<span class="seat-badge" style="color:#e57373;">⚠️ 잔여석 정보를 불러올 수 없습니다</span>`;
  }
}

/* ==============================================
   성별 선택 버튼
============================================== */
function selectGender(btn) {
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('gender').value = btn.dataset.val;
  updatePriceBox(btn.dataset.val);
}

function updatePriceBox(gender) {
  const amountEl = document.querySelector('.price-box__amount');
  if (!amountEl) return;
  if (gender === '남자') {
    amountEl.innerHTML = '39,000원 <span style="font-size:12px;font-weight:500;color:var(--gray-400);">얼리버드</span>';
  } else if (gender === '여자') {
    amountEl.innerHTML = '35,000원 <span style="font-size:12px;font-weight:500;color:var(--gray-400);">얼리버드</span>';
  }
}

/* ==============================================
   출생연도 검증
============================================== */
function validateBirthYear(year) {
  const errEl = document.getElementById('birth-year-error');
  if (!year) { showFieldError(errEl, '출생연도를 입력해 주세요.'); return false; }
  if (year < 1950 || year > 2007) { showFieldError(errEl, '올바른 출생연도를 입력해 주세요 (1950~2007).'); return false; }
  errEl.style.display = 'none';
  return true;
}
function showFieldError(el, msg) {
  if (!el) return;
  el.textContent   = msg;
  el.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  const byInput = document.getElementById('birth-year');
  if (byInput) {
    byInput.addEventListener('input', () => {
      const v = parseInt(byInput.value);
      if (byInput.value.length === 4) validateBirthYear(v);
      else document.getElementById('birth-year-error').style.display = 'none';
    });
  }
});

/* ==============================================
   글자 수 카운터
============================================== */
function updateCharCount(textarea) {
  const el = document.getElementById('char-count');
  if (el) el.textContent = textarea.value.length;
}

/* ==============================================
   사진 미리보기 / 삭제 / 드래그앤드롭
============================================== */
function validatePhoto(file) {
  const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
  if (!ok.includes(file.type.toLowerCase()) && !file.name.toLowerCase().endsWith('.heic')) {
    alert('JPG, PNG, WebP, HEIC 파일만 가능합니다.'); return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('파일 크기는 5MB 이하만 가능합니다.'); return false;
  }
  return true;
}

function previewPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (!validatePhoto(file)) { input.value = ''; return; }

  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('photo-preview-img').src   = e.target.result;
    document.getElementById('photo-placeholder').style.display = 'none';
    document.getElementById('photo-preview').style.display     = 'block';
    const si = document.getElementById('photo-size-info');
    if (si) si.textContent = (file.size / 1024).toFixed(0) + 'KB · ' + file.name;
  };
  reader.readAsDataURL(file);
}

function removePhoto(e) {
  e.preventDefault(); e.stopPropagation();
  document.getElementById('photo').value = '';
  document.getElementById('photo-preview-img').src           = '';
  document.getElementById('photo-preview').style.display     = 'none';
  document.getElementById('photo-placeholder').style.display = 'flex';
  const si = document.getElementById('photo-size-info');
  if (si) si.textContent = '';
}

const photoLabel = document.getElementById('photo-upload-label');
if (photoLabel) {
  photoLabel.addEventListener('dragover', e => {
    e.preventDefault();
    photoLabel.style.borderColor = 'var(--accent)';
    photoLabel.style.background  = 'rgba(201,160,99,0.08)';
  });
  photoLabel.addEventListener('dragleave', () => {
    photoLabel.style.borderColor = '';
    photoLabel.style.background  = '';
  });
  photoLabel.addEventListener('drop', e => {
    e.preventDefault();
    photoLabel.style.borderColor = '';
    photoLabel.style.background  = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt  = new DataTransfer();
      dt.items.add(file);
      const inp = document.getElementById('photo');
      inp.files = dt.files;
      previewPhoto(inp);
    }
  });
}

/* ==============================================
   사진 압축
============================================== */
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.onload  = e => {
      const img   = new Image();
      img.onerror = () => reject(new Error('이미지 로딩 실패'));
      img.onload  = () => {
        function compress(maxPx, quality) {
          let w = img.width, h = img.height;
          if (w > h && w > maxPx) { h = Math.round(h * maxPx / w); w = maxPx; }
          else if (h >= w && h > maxPx) { w = Math.round(w * maxPx / h); h = maxPx; }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          return c.toDataURL('image/jpeg', quality);
        }
        let b64 = compress(500, 0.75);
        if (b64.length > 90000) b64 = compress(400, 0.60);
        if (b64.length > 90000) b64 = compress(320, 0.50);
        if (b64.length > 90000) b64 = compress(240, 0.42);
        if (b64.length > 90000) b64 = compress(180, 0.38);
        resolve(b64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ==============================================
   개인정보 모달
============================================== */
function openPrivacyModal() {
  document.getElementById('privacy-modal').classList.add('open');
}
function closePrivacyModal(e) {
  if (e.target === document.getElementById('privacy-modal')) {
    document.getElementById('privacy-modal').classList.remove('open');
  }
}
function closePrivacyModalDirect() {
  document.getElementById('privacy-modal').classList.remove('open');
}

/* ==============================================
   신청 폼 제출
============================================== */
async function handleApply(event) {
  if (event) event.preventDefault();
  console.log('[ENTRE] 신청하기 버튼 클릭됨');

  const form    = document.getElementById('apply-form');
  const success = document.getElementById('apply-success');
  const btn     = document.getElementById('submit-btn');
  const errEl   = document.getElementById('apply-error');
  if (!form || !btn) { console.error('[ENTRE] 폼 또는 버튼 요소를 찾을 수 없음'); return; }
  if (btn.disabled) { console.log('[ENTRE] 이미 처리 중 — 중복 클릭 무시'); return; }

  errEl.style.display = 'none';

  const name        = document.getElementById('name').value.trim();
  const gender      = document.getElementById('gender').value;
  const phone       = document.getElementById('phone').value.trim();
  const birthYear   = parseInt(document.getElementById('birth-year').value);
  const job         = document.getElementById('job').value.trim();
  const sel         = document.getElementById('date');
  const selectedOpt = sel.options[sel.selectedIndex];
  const sessionId   = sel.value;
  const sessionLabel = selectedOpt
    ? (selectedOpt.dataset.sessionLabel || selectedOpt.textContent.trim()) : '';
  const expectation  = document.getElementById('expectation').value.trim();
  const photoInput   = document.getElementById('photo');
  const photoFile    = photoInput?.files?.[0] || null;

  if (!name)        { showErr(errEl, '이름을 입력해 주세요.');         return; }
  if (!gender)      { showErr(errEl, '성별을 선택해 주세요.');          return; }
  if (!phone)       { showErr(errEl, '연락처를 입력해 주세요.');        return; }
  if (!validateBirthYear(birthYear)) { showErr(errEl, '올바른 출생연도를 입력해 주세요 (1950~2007).'); return; }
  if (!job)         { showErr(errEl, '직업/소속을 입력해 주세요.');     return; }
  if (!sessionId)   { showErr(errEl, '희망 일정을 선택해 주세요. 일정이 없다면 관리자에게 문의하세요.'); return; }
  if (!expectation) { showErr(errEl, '모임에서 기대하는 점을 입력해 주세요.'); return; }
  if (!photoFile)   { showErr(errEl, '프로필 사진을 첨부해 주세요.');   return; }
  if (!validatePhoto(photoFile)) { showErr(errEl, '사진 파일이 올바르지 않습니다. JPG/PNG/WebP/HEIC 5MB 이하만 가능합니다.'); return; }

  btn.textContent   = '⏳ 신청 중...';
  btn.disabled      = true;
  btn.style.opacity = '0.6';
  console.log('[ENTRE] 유효성 검증 통과, API 호출 시작');

  try {
    /* ① 기본 정보 저장 */
    const r1 = await fetch('tables/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId, session_label: sessionLabel,
        name, gender, phone,
        birth_year: String(birthYear),
        job, expectation,
        status: '대기',
      }),
    });
    if (!r1.ok) throw new Error('신청 저장 실패 (HTTP ' + r1.status + ')');
    const app   = await r1.json();
    const appId = app.id;
    if (!appId) throw new Error('신청 ID를 받지 못했습니다. 응답: ' + JSON.stringify(app).slice(0, 200));

    /* ② 사진 압축 → 저장 */
    btn.textContent = '📷 사진 저장 중...';
    const b64 = await compressPhoto(photoFile);
    if (!b64 || !b64.startsWith('data:image')) throw new Error('사진 압축 실패 — 결과가 올바른 이미지 데이터가 아닙니다');

    const r2 = await fetch('tables/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: appId, photo_data: b64 }),
    });
    if (!r2.ok) throw new Error('사진 저장 실패 (HTTP ' + r2.status + ')');
    const saved = await r2.json();
    if (!saved.id) throw new Error('사진 저장 응답에 ID가 없습니다');

    /* ③ 완료 */
    console.log('[ENTRE] ✅ 신청 완료!');
    form.style.display    = 'none';
    success.style.display = 'block';
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    console.error('[ENTRE] ❌ 신청 실패:', err);
    btn.textContent   = '신청하기';
    btn.disabled      = false;
    btn.style.opacity = '';
    showErr(errEl, '오류가 발생했습니다: ' + err.message + '\n잠시 후 다시 시도하거나 관리자에게 문의해 주세요.');
  }
}

function showErr(el, msg) {
  el.textContent   = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ==============================================
   전화번호 자동 하이픈
============================================== */
document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '');
      if      (v.length <= 3)  e.target.value = v;
      else if (v.length <= 7)  e.target.value = v.slice(0,3) + '-' + v.slice(3);
      else                     e.target.value = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7,11);
    });
  }
  loadSessionDates();

  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleApply);
    const applyForm = document.getElementById('apply-form');
    if (applyForm) applyForm.addEventListener('submit', handleApply);
  }
});

/* ==============================================
   스크롤 애니메이션
============================================== */
const animEls = document.querySelectorAll(
  '.pain__card, .timeline-item, .rotation__card, .pricing__card, .schedule__row, .faq__item'
);
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity   = '1';
      entry.target.style.transform = 'translateY(0)';
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

animEls.forEach(el => {
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(18px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  fadeObserver.observe(el);
});
