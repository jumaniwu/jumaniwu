/* ===== RecruitFit app.js ===== */
'use strict';

// ── Storage Keys ──
const RF_JOBS = 'rf_jobs';
const RF_APPLICANTS = 'rf_applicants';
const RF_PENDING = 'rf_pending';

// ── Utilities ──
function getJobs() { try { return JSON.parse(localStorage.getItem(RF_JOBS)) || []; } catch { return []; } }
function saveJobs(d) { localStorage.setItem(RF_JOBS, JSON.stringify(d)); }
function getApplicants() { try { return JSON.parse(localStorage.getItem(RF_APPLICANTS)) || []; } catch { return []; } }
function saveApplicants(d) { localStorage.setItem(RF_APPLICANTS, JSON.stringify(d)); }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}); }
function genId() { return 'rf_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

function clearAllData() {
  if (!confirm('Clear ALL data? This cannot be undone.')) return;
  localStorage.removeItem(RF_JOBS); localStorage.removeItem(RF_APPLICANTS); localStorage.removeItem(RF_PENDING);
  alert('All data cleared.'); location.reload();
}

function loadDemoData() {
  const jobs = [
    { id:'job_1', title:'Frontend Developer', department:'Technology', location:'Jakarta, Indonesia', type:'Full-time', salary:'Rp 8M – 15M', status:'open', vacancies:2, deadline:'2026-05-30', description:'Build modern web UIs with React and TypeScript.', createdAt: new Date(Date.now()-5*86400000).toISOString() },
    { id:'job_2', title:'Marketing Manager', department:'Marketing', location:'Jakarta, Indonesia', type:'Full-time', salary:'Rp 12M – 18M', status:'open', vacancies:1, deadline:'2026-04-28', description:'Lead digital marketing campaigns and brand strategy.', createdAt: new Date(Date.now()-10*86400000).toISOString() },
    { id:'job_3', title:'HR Specialist', department:'HR', location:'Remote', type:'Remote', salary:'Rp 7M – 10M', status:'open', vacancies:1, deadline:'2026-05-15', description:'Manage recruitment, onboarding and employee relations.', createdAt: new Date(Date.now()-3*86400000).toISOString() }
  ];
  const applicants = [
    { id:'app_1', name:'Budi Santoso', email:'budi@email.com', phone:'0812-3456-7890', position:'Frontend Developer', experience:'3-5 years', education:'S1', score:87, correct:13, total:15, passed:true, logicScore:80, personalityScore:100, situationalScore:80, violations:0, date: new Date(Date.now()-1*86400000).toISOString() },
    { id:'app_2', name:'Siti Rahayu', email:'siti@email.com', phone:'0813-9876-5432', position:'Marketing Manager', experience:'5+ years', education:'S2', score:73, correct:11, total:15, passed:true, logicScore:60, personalityScore:80, situationalScore:80, violations:1, date: new Date(Date.now()-2*86400000).toISOString() },
    { id:'app_3', name:'Ahmad Fauzi', email:'ahmad@email.com', phone:'0857-1234-5678', position:'HR Specialist', experience:'1-2 years', education:'S1', score:47, correct:7, total:15, passed:false, logicScore:40, personalityScore:60, situationalScore:40, violations:0, date: new Date(Date.now()-3*86400000).toISOString() },
    { id:'app_4', name:'Dewi Lestari', email:'dewi@email.com', phone:'0878-5555-1234', position:'Frontend Developer', experience:'Fresh Graduate', education:'S1', score:60, correct:9, total:15, passed:true, logicScore:60, personalityScore:60, situationalScore:60, violations:0, date: new Date(Date.now()-4*86400000).toISOString() },
    { id:'app_5', name:'Rizal Pratama', email:'rizal@email.com', phone:'0821-9999-8888', position:'Marketing Manager', experience:'3-5 years', education:'S1', score:40, correct:6, total:15, passed:false, logicScore:40, personalityScore:20, situationalScore:60, violations:2, date: new Date(Date.now()-5*86400000).toISOString() }
  ];
  saveJobs(jobs); saveApplicants(applicants);
  alert('Demo data loaded!'); location.reload();
}

// ── DASHBOARD ──
function initDashboard() {
  const jobs = getJobs();
  const applicants = getApplicants();
  const passed = applicants.filter(a => a.passed).length;
  const openJobs = jobs.filter(j => j.status === 'open').length;
  const passRate = applicants.length ? Math.round((passed / applicants.length) * 100) : 0;

  const el = id => document.getElementById(id);
  if (el('totalApplicants')) el('totalApplicants').textContent = applicants.length;
  if (el('openJobs')) el('openJobs').textContent = openJobs;
  if (el('testsCompleted')) el('testsCompleted').textContent = applicants.length;
  if (el('passRate')) el('passRate').textContent = passRate + '%';
  if (el('applicantChange')) el('applicantChange').textContent = applicants.length + ' total submissions';
  if (el('jobChange')) el('jobChange').textContent = openJobs + ' active listing' + (openJobs !== 1 ? 's' : '');

  // Recent applicants table
  const tbody = el('recentApplicantsBody');
  if (tbody) {
    const recent = [...applicants].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:2rem;">No applicants yet. Share the <a href="apply.html" style="color:var(--primary);">apply link</a> with candidates.</td></tr>';
    } else {
      tbody.innerHTML = recent.map(a => {
        const badge = a.passed ? '<span class="badge badge-success">Pass</span>' : '<span class="badge badge-danger">Fail</span>';
        const scoreColor = a.score >= 60 ? 'var(--success)' : 'var(--danger)';
        return '<tr><td><strong>' + escHtml(a.name) + '</strong><br><small style="color:var(--gray);">' + escHtml(a.email) + '</small></td><td>' + escHtml(a.position) + '</td><td><span style="font-weight:700;color:' + scoreColor + '">' + a.score + '%</span></td><td>' + formatDate(a.date) + '</td><td>' + badge + '</td></tr>';
      }).join('');
    }
  }

  // Open jobs sidebar
  const jobsList = el('openJobsList');
  if (jobsList) {
    const open = jobs.filter(j => j.status === 'open').slice(0, 5);
    if (!open.length) {
      jobsList.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg><h3>No open jobs</h3><p><a href="jobs.html" style="color:var(--primary);">Post your first job</a></p></div>';
    } else {
      jobsList.innerHTML = open.map(j => {
        const count = getApplicants().filter(a => a.position === j.title).length;
        return '<div style="padding:0.75rem 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:600;font-size:0.875rem;">' + escHtml(j.title) + '</div><div style="font-size:0.75rem;color:var(--gray);">' + escHtml(j.department) + ' · ' + escHtml(j.location) + '</div></div><span class="badge badge-info">' + count + ' applicant' + (count !== 1 ? 's' : '') + '</span></div>';
      }).join('');
    }
  }
}

// ── JOBS PAGE ──
let editingJobId = null;

function renderJobs() {
  const jobs = getJobs();
  const search = (document.getElementById('searchJobs') || {}).value || '';
  const dept = (document.getElementById('filterDept') || {}).value || '';
  const status = (document.getElementById('filterStatus') || {}).value || '';
  const grid = document.getElementById('jobsGrid');
  if (!grid) return;

  let filtered = jobs.filter(j => {
    const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase());
    const matchDept = !dept || j.department === dept;
    const matchStatus = !status || j.status === status;
    return matchSearch && matchDept && matchStatus;
  });

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg><h3>No jobs found</h3><p>Try adjusting your filters or <a href="#" onclick="openJobModal()" style="color:var(--primary);">post a new job</a></p></div>';
    return;
  }

  const statusBadge = s => s === 'open' ? 'badge-success' : s === 'draft' ? 'badge-warning' : 'badge-gray';
  const typeBadge = t => '<span class="badge badge-info">' + escHtml(t) + '</span>';

  grid.innerHTML = filtered.map(j => {
    const applicantCount = getApplicants().filter(a => a.position === j.title).length;
    return '<div class="job-card"><div class="job-card-header"><div><div class="job-title">' + escHtml(j.title) + '</div><div class="job-dept">' + escHtml(j.department) + '</div></div><span class="badge ' + statusBadge(j.status) + '">' + j.status + '</span></div><div class="job-meta"><span class="job-meta-item"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' + escHtml(j.location) + '</span><span class="job-meta-item"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>' + escHtml(j.type) + '</span>' + (j.deadline ? '<span class="job-meta-item"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Deadline: ' + formatDate(j.deadline) + '</span>' : '') + '</div>' + (j.salary ? '<div style="font-size:0.8rem;color:var(--gray);margin-bottom:0.5rem;">💰 ' + escHtml(j.salary) + '</div>' : '') + '<div class="job-footer"><span class="job-applicants"><strong>' + applicantCount + '</strong> applicant' + (applicantCount !== 1 ? 's' : '') + '</span><div class="job-actions"><button class="btn btn-outline" onclick="openJobModal(\'' + j.id + '\')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button><button class="btn btn-danger" onclick="deleteJob(\'' + j.id + '\')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Delete</button></div></div></div>';
  }).join('');
}

function openJobModal(id) {
  editingJobId = id || null;
  const modal = document.getElementById('jobModal');
  const title = document.getElementById('modalTitle');
  if (!modal) return;
  if (id) {
    const job = getJobs().find(j => j.id === id);
    if (!job) return;
    title.textContent = 'Edit Job';
    document.getElementById('jobTitle').value = job.title || '';
    document.getElementById('jobDept').value = job.department || '';
    document.getElementById('jobLocation').value = job.location || '';
    document.getElementById('jobType').value = job.type || 'Full-time';
    document.getElementById('jobSalary').value = job.salary || '';
    document.getElementById('jobDeadline').value = job.deadline || '';
    document.getElementById('jobDesc').value = job.description || '';
    document.getElementById('jobVacancies').value = job.vacancies || 1;
    document.getElementById('jobStatus').value = job.status || 'open';
  } else {
    title.textContent = 'Post New Job';
    ['jobTitle','jobDept','jobLocation','jobSalary','jobDeadline','jobDesc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('jobType').value = 'Full-time';
    document.getElementById('jobVacancies').value = 1;
    document.getElementById('jobStatus').value = 'open';
  }
  modal.classList.add('active');
}

function closeJobModal() {
  const modal = document.getElementById('jobModal');
  if (modal) modal.classList.remove('active');
  editingJobId = null;
}

function saveJob() {
  const title = document.getElementById('jobTitle').value.trim();
  const dept = document.getElementById('jobDept').value;
  const location = document.getElementById('jobLocation').value.trim();
  if (!title) { alert('Job title is required.'); return; }
  if (!dept) { alert('Please select a department.'); return; }
  if (!location) { alert('Location is required.'); return; }
  const jobs = getJobs();
  const jobData = {
    id: editingJobId || genId(),
    title, department: dept, location,
    type: document.getElementById('jobType').value,
    salary: document.getElementById('jobSalary').value.trim(),
    deadline: document.getElementById('jobDeadline').value,
    description: document.getElementById('jobDesc').value.trim(),
    vacancies: parseInt(document.getElementById('jobVacancies').value) || 1,
    status: document.getElementById('jobStatus').value,
    createdAt: editingJobId ? (jobs.find(j => j.id === editingJobId) || {}).createdAt : new Date().toISOString()
  };
  if (editingJobId) {
    const idx = jobs.findIndex(j => j.id === editingJobId);
    if (idx !== -1) jobs[idx] = jobData;
  } else {
    jobs.unshift(jobData);
  }
  saveJobs(jobs);
  closeJobModal();
  renderJobs();
}

function deleteJob(id) {
  if (!confirm('Delete this job posting? This cannot be undone.')) return;
  saveJobs(getJobs().filter(j => j.id !== id));
  renderJobs();
}

// ── APPLY PAGE ──
function initApplyPage() {
  const sel = document.getElementById('applicantPosition');
  if (!sel) return;
  const jobs = getJobs().filter(j => j.status === 'open');
  const defaults = ['Frontend Developer','Backend Developer','Marketing Manager','HR Specialist','Data Analyst','Product Manager','UI/UX Designer','Sales Executive'];
  const positions = jobs.length ? jobs.map(j => j.title) : defaults;
  const existing = Array.from(sel.options).map(o => o.value);
  positions.forEach(p => {
    if (!existing.includes(p)) {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      sel.appendChild(opt);
    }
  });
}

function setWizardStep(step) {
  for (let i = 1; i <= 3; i++) {
    const ind = document.getElementById('stepIndicator' + i);
    if (!ind) continue;
    ind.classList.remove('active', 'completed');
    if (i < step) ind.classList.add('completed');
    else if (i === step) ind.classList.add('active');
  }
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('step' + i);
    if (el) el.style.display = i === step ? '' : 'none';
  }
}

function goToStep1() { setWizardStep(1); }

function goToStep2() {
  const name = document.getElementById('applicantName').value.trim();
  const email = document.getElementById('applicantEmail').value.trim();
  const phone = document.getElementById('applicantPhone').value.trim();
  const position = document.getElementById('applicantPosition').value;
  if (!name) { alert('Please enter your full name.'); document.getElementById('applicantName').focus(); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Please enter a valid email address.'); document.getElementById('applicantEmail').focus(); return; }
  if (!phone) { alert('Please enter your phone number.'); document.getElementById('applicantPhone').focus(); return; }
  if (!position) { alert('Please select a position.'); document.getElementById('applicantPosition').focus(); return; }
  setWizardStep(2);
  window.scrollTo(0, 0);
}

function startTest() {
  const agree = document.getElementById('agreeTerms');
  if (!agree || !agree.checked) { alert('Please agree to the test rules before continuing.'); return; }
  const pending = {
    id: genId(),
    name: document.getElementById('applicantName').value.trim(),
    email: document.getElementById('applicantEmail').value.trim(),
    phone: document.getElementById('applicantPhone').value.trim(),
    dob: (document.getElementById('applicantDob') || {}).value || '',
    position: document.getElementById('applicantPosition').value,
    education: (document.getElementById('applicantEdu') || {}).value || '',
    experience: (document.getElementById('applicantExp') || {}).value || '',
    cover: (document.getElementById('applicantCover') || {}).value || '',
    resumeName: (() => { const f = document.getElementById('applicantResume'); return f && f.files.length ? f.files[0].name : ''; })(),
    startedAt: new Date().toISOString()
  };
  localStorage.setItem(RF_PENDING, JSON.stringify(pending));
  setWizardStep(3);
  let count = 3;
  const cd = document.getElementById('redirectCountdown');
  const timer = setInterval(() => {
    count--;
    if (cd) cd.textContent = 'Redirecting in ' + count + ' second' + (count !== 1 ? 's' : '') + '...';
    if (count <= 0) { clearInterval(timer); window.location.href = 'test.html'; }
  }, 1000);
}

// ── TEST PAGE ──
const QUESTIONS = [
  // Logic (1-5)
  { category:'logic', text:'If all Bloops are Razzles and all Razzles are Lazzles, then all Bloops are:', options:['Lazzles','Razzles but not Lazzles','Bloops only','None of the above'], correct:0 },
  { category:'logic', text:'Which number comes next in the sequence: 2, 6, 12, 20, 30, ?', options:['40','42','44','48'], correct:1 },
  { category:'logic', text:'A clock shows 3:15. What is the angle between the hour and minute hands?', options:['0°','7.5°','52.5°','90°'], correct:1 },
  { category:'logic', text:'If you rearrange the letters "CIFAIPC", you get the name of a(n):', options:['City','Animal','Ocean','Country'], correct:2 },
  { category:'logic', text:'A shop sells apples at 3 for Rp 10,000. How much do 9 apples cost?', options:['Rp 20,000','Rp 27,000','Rp 30,000','Rp 33,000'], correct:2 },
  // Personality (6-10)
  { category:'personality', text:'When given a complex project with no clear instructions, you typically:', options:['Wait for detailed instructions before starting','Break the project into steps and start immediately','Ask colleagues how they would approach it','Suggest the project scope is too vague'], correct:1 },
  { category:'personality', text:'A colleague takes credit for your idea in a team meeting. You would most likely:', options:['Say nothing and move on','Privately confront the colleague later','Immediately correct the record respectfully','Report it to your manager'], correct:2 },
  { category:'personality', text:'You are most energized at work when you are:', options:['Working alone on deep focused tasks','Collaborating with a team on shared goals','Meeting new clients and building relationships','Following clear processes and routines'], correct:1 },
  { category:'personality', text:'When you make a significant mistake at work, your first reaction is to:', options:['Hope no one notices','Immediately inform your manager and propose a fix','Analyze what went wrong before telling anyone','Ask a colleague how to handle it'], correct:1 },
  { category:'personality', text:'How do you handle multiple urgent deadlines simultaneously?', options:['Prioritize by importance and communicate any risks','Try to do everything at once','Ask for all deadlines to be extended','Focus on the easiest task first'], correct:0 },
  // Situational (11-15)
  { category:'situational', text:'A client is furious about a delayed delivery that was not your fault. You would:', options:['Explain it is not your fault','Apologize, take ownership, and outline a resolution plan','Transfer the call to your manager','Offer a discount without consulting your manager'], correct:1 },
  { category:'situational', text:'You discover a coworker is cutting corners that compromise product quality. You would:', options:['Ignore it — not your responsibility','Fix the issues yourself without saying anything','Raise the concern with the coworker first, then escalate if needed','Immediately report to management'], correct:2 },
  { category:'situational', text:'You disagree with a decision your manager has made. The best approach is to:', options:['Comply and say nothing','Vent frustration to teammates','Request a meeting to share your perspective with data','Refuse to implement the decision'], correct:2 },
  { category:'situational', text:'Your team is behind schedule. A team member is struggling but not asking for help. You would:', options:['Ignore it — they should ask for help themselves','Assign their tasks to someone else','Check in with them privately and offer support','Tell the manager they are underperforming'], correct:2 },
  { category:'situational', text:'You are asked to complete a task outside your expertise with a tight deadline. You would:', options:['Decline the task entirely','Attempt it alone and hope for the best','Accept, identify gaps quickly, and seek targeted help','Ask for the deadline to be moved'], correct:2 }
];

let currentQ = 0;
let answers = new Array(15).fill(null);
let violations = 0;
let timerInterval = null;
let timeLeft = 30 * 60;
let testSubmitted = false;

function initTest() {
  const pending = JSON.parse(localStorage.getItem(RF_PENDING) || 'null');
  const nameEl = document.getElementById('candidateName');
  if (nameEl) nameEl.textContent = pending ? pending.name : 'Candidate';
  if (!pending) {
    setTimeout(() => { if (confirm('No application found. Go to apply page?')) window.location.href = 'apply.html'; }, 500);
    return;
  }
  startTimer();
  renderQuestion(0);
  setupAntiCheat();
}

function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    const display = document.getElementById('timerDisplay');
    if (display) display.textContent = m + ':' + s;
    const timer = document.getElementById('timer');
    if (timer && timeLeft <= 300) timer.classList.add('warning');
    if (timeLeft <= 0) { clearInterval(timerInterval); submitTest(); }
  }, 1000);
}

function renderQuestion(idx) {
  currentQ = idx;
  const q = QUESTIONS[idx];
  const total = QUESTIONS.length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

  set('qCounter', 'Question ' + (idx+1) + ' of ' + total);
  set('questionCounter', (idx+1) + ' / ' + total);
  set('qText', q.text);

  const catEl = document.getElementById('qCategory');
  if (catEl) {
    const labels = { logic:'Logical Reasoning', personality:'Personality Assessment', situational:'Situational Judgment' };
    catEl.textContent = labels[q.category] || q.category;
    catEl.className = 'question-category ' + q.category;
  }

  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = ((idx + 1) / total * 100) + '%';

  const letters = ['A','B','C','D'];
  const optList = document.getElementById('optionsList');
  if (optList) {
    optList.innerHTML = q.options.map((opt, i) => {
      const sel = answers[idx] === i ? ' selected' : '';
      return '<div class="option-item' + sel + '" onclick="selectAnswer(' + i + ')"><div class="option-letter">' + letters[i] + '</div><div class="option-text">' + escHtml(opt) + '</div></div>';
    }).join('');
  }

  const dots = document.getElementById('questionDots');
  if (dots) {
    dots.innerHTML = Array.from({length: total}, (_, i) => {
      let cls = 'q-dot';
      if (i === idx) cls += ' current';
      else if (answers[i] !== null) cls += ' answered';
      return '<div class="' + cls + '" title="Q' + (i+1) + '"></div>';
    }).join('');
  }

  const prev = document.getElementById('prevBtn');
  if (prev) prev.style.opacity = idx === 0 ? '0.4' : '1';
  const next = document.getElementById('nextBtn');
  if (next) {
    if (idx === total - 1) { next.textContent = 'Submit Test'; next.className = 'btn btn-success'; }
    else { next.innerHTML = 'Next <svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="9 18 15 12 9 6"/></svg>'; next.className = 'btn btn-primary'; }
  }
}

function selectAnswer(i) {
  answers[currentQ] = i;
  renderQuestion(currentQ);
}

function prevQuestion() { if (currentQ > 0) renderQuestion(currentQ - 1); }
function nextQuestion() {
  if (currentQ < QUESTIONS.length - 1) renderQuestion(currentQ + 1);
  else submitTest();
}

function setupAntiCheat() {
  document.addEventListener('visibilitychange', onTabSwitch);
  window.addEventListener('blur', onTabSwitch);
  ['contextmenu','copy','cut','paste','selectstart'].forEach(e => {
    document.addEventListener(e, ev => ev.preventDefault());
  });
}

let lastViolationTime = 0;
function onTabSwitch() {
  if (testSubmitted || document.visibilityState === 'visible') return;
  const now = Date.now();
  if (now - lastViolationTime < 2000) return;
  lastViolationTime = now;
  violations++;
  const warnEl = document.getElementById('cheatWarning');
  const countEl = document.getElementById('warningCount');
  if (countEl) countEl.textContent = violations;
  if (warnEl) { warnEl.style.display = 'block'; setTimeout(() => { warnEl.style.display = 'none'; }, 4000); }
  if (violations >= 3) { submitTest(); return; }
  const overlay = document.getElementById('warningOverlay');
  const vnum = document.getElementById('violationNum');
  if (vnum) vnum.textContent = violations;
  if (overlay) overlay.classList.add('show');
}

function dismissWarning() {
  const overlay = document.getElementById('warningOverlay');
  if (overlay) overlay.classList.remove('show');
}

function submitTest() {
  if (testSubmitted) return;
  testSubmitted = true;
  clearInterval(timerInterval);
  document.removeEventListener('visibilitychange', onTabSwitch);
  window.removeEventListener('blur', onTabSwitch);

  const logicCorrect = QUESTIONS.slice(0, 5).filter((q, i) => answers[i] === q.correct).length;
  const personalityCorrect = QUESTIONS.slice(5, 10).filter((q, i) => answers[i+5] === q.correct).length;
  const situationalCorrect = QUESTIONS.slice(10, 15).filter((q, i) => answers[i+10] === q.correct).length;
  const totalCorrect = logicCorrect + personalityCorrect + situationalCorrect;
  const score = Math.round((totalCorrect / 15) * 100);
  const passed = score >= 60;

  const pending = JSON.parse(localStorage.getItem(RF_PENDING) || '{}');
  const result = Object.assign({}, pending, {
    score, correct: totalCorrect, total: 15, passed,
    logicScore: Math.round(logicCorrect / 5 * 100),
    personalityScore: Math.round(personalityCorrect / 5 * 100),
    situationalScore: Math.round(situationalCorrect / 5 * 100),
    violations, answers: answers.slice(),
    date: new Date().toISOString()
  });

  const all = getApplicants();
  all.unshift(result);
  saveApplicants(all);
  localStorage.removeItem(RF_PENDING);

  showResult(result);
}

function showResult(r) {
  const qWrap = document.getElementById('questionWrap');
  const resScreen = document.getElementById('resultScreen');
  if (qWrap) qWrap.style.display = 'none';
  if (resScreen) resScreen.style.display = '';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  set('resultIcon', r.passed ? '🎉' : '😔');
  set('resultTitle', r.passed ? 'Congratulations! You Passed!' : 'Better Luck Next Time');
  set('resultSubtitle', r.passed ? 'Your score meets the passing threshold. Our HR team will be in touch soon.' : 'Your score did not meet the 60% passing threshold. Thank you for applying.');
  set('finalScore', r.score + '%');
  set('categoryScores',
    '<div style="text-align:center;padding:1rem;background:rgba(6,182,212,0.1);border-radius:10px;border:1px solid rgba(6,182,212,0.2)"><div style="font-size:1.25rem;font-weight:800;color:#67E8F9">' + r.logicScore + '%</div><div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em">Logic</div></div>' +
    '<div style="text-align:center;padding:1rem;background:rgba(139,92,246,0.1);border-radius:10px;border:1px solid rgba(139,92,246,0.2)"><div style="font-size:1.25rem;font-weight:800;color:#C4B5FD">' + r.personalityScore + '%</div><div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em">Personality</div></div>' +
    '<div style="text-align:center;padding:1rem;background:rgba(245,158,11,0.1);border-radius:10px;border:1px solid rgba(245,158,11,0.2)"><div style="font-size:1.25rem;font-weight:800;color:#FCD34D">' + r.situationalScore + '%</div><div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em">Situational</div></div>'
  );
  set('resultDetail',
    '<div style="margin-bottom:0.75rem;"><strong style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.4)">Test Summary</strong></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.85rem;">' +
    '<div style="color:rgba(255,255,255,0.6)">Candidate</div><div style="color:white;font-weight:600">' + escHtml(r.name || 'N/A') + '</div>' +
    '<div style="color:rgba(255,255,255,0.6)">Position</div><div style="color:white;font-weight:600">' + escHtml(r.position || 'N/A') + '</div>' +
    '<div style="color:rgba(255,255,255,0.6)">Correct Answers</div><div style="color:white;font-weight:600">' + r.correct + ' / 15</div>' +
    '<div style="color:rgba(255,255,255,0.6)">Violations</div><div style="color:' + (r.violations > 0 ? '#FCA5A5' : '#86EFAC') + ';font-weight:600">' + r.violations + '</div>' +
    '</div>'
  );
}

// ── RESULTS PAGE ──
function initResults() {
  const applicants = getApplicants();
  const passed = applicants.filter(a => a.passed).length;
  const avg = applicants.length ? Math.round(applicants.reduce((s,a) => s + (a.score||0), 0) / applicants.length) : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('totalCandidates', applicants.length);
  set('passCount', passed);
  set('failCount', applicants.length - passed);
  set('avgScore', avg + '%');

  const sel = document.getElementById('filterPosition');
  if (sel) {
    const positions = [...new Set(applicants.map(a => a.position).filter(Boolean))].sort();
    positions.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      sel.appendChild(opt);
    });
  }
  renderResults();
}

function renderResults() {
  const applicants = getApplicants();
  const search = (document.getElementById('searchResults') || {}).value || '';
  const position = (document.getElementById('filterPosition') || {}).value || '';
  const status = (document.getElementById('filterResultStatus') || {}).value || '';

  let filtered = applicants.filter(a => {
    const matchSearch = !search || (a.name||'').toLowerCase().includes(search.toLowerCase()) || (a.email||'').toLowerCase().includes(search.toLowerCase());
    const matchPos = !position || a.position === position;
    const matchStatus = !status || (status === 'pass' && a.passed) || (status === 'fail' && !a.passed);
    return matchSearch && matchPos && matchStatus;
  });

  const tbody = document.getElementById('resultsTableBody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--gray);padding:3rem;">' + (applicants.length ? 'No results match your filters.' : 'No test results yet.') + '</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((a, i) => {
    const badge = a.passed ? '<span class="badge badge-success">Pass</span>' : '<span class="badge badge-danger">Fail</span>';
    const scoreColor = a.score >= 60 ? 'var(--success)' : 'var(--danger)';
    const vioBadge = a.violations > 0 ? '<span class="badge badge-warning">' + a.violations + '</span>' : '<span style="color:var(--gray)">0</span>';
    return '<tr>' +
      '<td style="color:var(--gray);font-size:0.8rem;">' + (i+1) + '</td>' +
      '<td><strong>' + escHtml(a.name||'') + '</strong><br><small style="color:var(--gray);">' + escHtml(a.email||'') + '</small></td>' +
      '<td>' + escHtml(a.position||'') + '</td>' +
      '<td><div style="display:flex;align-items:center;gap:0.5rem;"><div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="width:' + (a.score||0) + '%;height:100%;background:' + scoreColor + ';border-radius:3px;"></div></div><span style="font-weight:700;color:' + scoreColor + '">' + (a.score||0) + '%</span></div></td>' +
      '<td><span style="color:#67E8F9;font-weight:600;">' + (a.logicScore||0) + '%</span></td>' +
      '<td><span style="color:#C4B5FD;font-weight:600;">' + (a.personalityScore||0) + '%</span></td>' +
      '<td><span style="color:#FCD34D;font-weight:600;">' + (a.situationalScore||0) + '%</span></td>' +
      '<td>' + vioBadge + '</td>' +
      '<td style="white-space:nowrap;">' + formatDate(a.date) + '</td>' +
      '<td>' + badge + '</td>' +
      '<td><button class="btn btn-outline" style="font-size:0.75rem;padding:0.3rem 0.6rem;" onclick="viewCandidate(\''+a.id+'\')">View</button></td>' +
      '</tr>';
  }).join('');
}

function viewCandidate(id) {
  const a = getApplicants().find(x => x.id === id);
  if (!a) return;
  const modal = document.getElementById('candidateModal');
  const content = document.getElementById('candidateDetailContent');
  if (!modal || !content) return;
  const badge = a.passed ? '<span class="badge badge-success" style="font-size:1rem;padding:0.4rem 1rem;">PASS</span>' : '<span class="badge badge-danger" style="font-size:1rem;padding:0.4rem 1rem;">FAIL</span>';
  const scoreColor = a.score >= 60 ? 'var(--success)' : 'var(--danger)';
  content.innerHTML =
    '<div style="text-align:center;padding:1rem 0 1.5rem;border-bottom:1px solid var(--border);margin-bottom:1.5rem;">' +
    '<div style="width:64px;height:64px;background:var(--primary-light);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem;font-size:1.5rem;font-weight:800;color:var(--primary);">' + (a.name||'?').charAt(0).toUpperCase() + '</div>' +
    '<h3 style="font-weight:800;margin-bottom:0.25rem;">' + escHtml(a.name||'') + '</h3>' +
    '<p style="color:var(--gray);font-size:0.875rem;">' + escHtml(a.position||'') + '</p>' +
    badge + '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.5rem;">' +
    row('Email', a.email) + row('Phone', a.phone) + row('Education', a.education) + row('Experience', a.experience) + row('Date Applied', formatDate(a.date)) + row('Violations', a.violations + ' detected') +
    '</div>' +
    '<div style="background:var(--light-gray);border-radius:10px;padding:1.25rem;">' +
    '<div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--gray);margin-bottom:1rem;">Test Scores</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;text-align:center;">' +
    scoreBox('Total', a.score + '%', scoreColor) + scoreBox('Logic', (a.logicScore||0) + '%', '#4F46E5') + scoreBox('Personality', (a.personalityScore||0) + '%', '#8B5CF6') +
    '</div></div>';
  modal.classList.add('active');
}

function row(label, value) {
  return '<div><div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--gray);">' + label + '</div><div style="font-size:0.875rem;font-weight:600;margin-top:0.15rem;">' + escHtml(value||'—') + '</div></div>';
}
function scoreBox(label, value, color) {
  return '<div style="background:white;border-radius:8px;padding:0.75rem;border:1px solid var(--border);"><div style="font-size:1.25rem;font-weight:800;color:' + color + ';">' + value + '</div><div style="font-size:0.72rem;color:var(--gray);">' + label + '</div></div>';
}

function closeCandidateModal() {
  const modal = document.getElementById('candidateModal');
  if (modal) modal.classList.remove('active');
}

function exportCSV() {
  const applicants = getApplicants();
  if (!applicants.length) { alert('No data to export.'); return; }
  const headers = ['Name','Email','Phone','Position','Education','Experience','Score (%)','Correct','Total','Logic %','Personality %','Situational %','Violations','Date','Status'];
  const rows = applicants.map(a => [
    a.name||'', a.email||'', a.phone||'', a.position||'', a.education||'', a.experience||'',
    a.score||0, a.correct||0, a.total||15, a.logicScore||0, a.personalityScore||0, a.situationalScore||0,
    a.violations||0, a.date ? new Date(a.date).toLocaleDateString() : '', a.passed ? 'Pass' : 'Fail'
  ].map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','));
  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'recruitfit-results-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(link); link.click();
  document.body.removeChild(link); URL.revokeObjectURL(url);
}

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
