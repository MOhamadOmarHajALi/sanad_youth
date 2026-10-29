// اختبار شامل يشغَّل على خادم قيد العمل:  BASE=http://localhost:3000 node test/smoke.mjs
// يتطلب تشغيل الخادم بـ TRUST_PROXY=1 (لنُحاكي IP مختلف لكل مستخدم) وتشغيل `npm run seed` قبله.
const BASE = process.env.BASE ?? 'http://localhost:3000';
const ADMIN = { identifier: process.env.ADMIN_EMAIL ?? 'admin@example.com', password: process.env.ADMIN_PASSWORD ?? 'ChangeMe123!' };
const run = Date.now().toString(36);
let ipN = 1, pass = 0, fail = 0;

async function call(method, path, { token, json, form, ip } = {}) {
  const headers = { 'X-Forwarded-For': ip ?? `10.0.0.${ipN++}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(BASE + path, { method, headers, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let data; try { data = JSON.parse(buf.toString()); } catch { data = buf; }
  return { status: res.status, data };
}
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); }
}
const pdf = (name = 'cv.pdf') => new Blob(['%PDF-1.4\n%fake but valid header\n'], { type: 'application/pdf' });
const login = async (identifier, password) => (await call('POST', '/auth/login', { json: { identifier, password } })).data;
async function newYouth(tag) {
  const u = `y${tag}_${run}`;
  const r = await call('POST', '/auth/register', { json: { fullName: `Youth ${tag}`, username: u, email: `${u}@t.io`, password: 'Passw0rd!!' } });
  const t = await login(u, 'Passw0rd!!');
  return { id: r.data.user?.id, token: t.accessToken, refresh: t.refreshToken, reg: r };
}
const apply = (token, programId, blob = pdf()) => {
  const f = new FormData(); f.set('programId', String(programId)); if (blob) f.set('cv', blob, 'cv.pdf');
  return call('POST', '/applications', { token, form: f });
};

console.log('\n[1] Auth & أمان التسجيل');
const A = await newYouth('A'), B = await newYouth('B'), C = await newYouth('C');
check('register يعمل ولا يعيد كلمة المرور', A.reg.status === 201 && !('password' in A.reg.data.user));
const esc = await call('POST', '/auth/register', { json: { fullName: 'x', username: `h${run}`, email: `h${run}@t.io`, password: 'Passw0rd!!', role: 'ADMIN' } });
check('محاولة رفع الصلاحية role=ADMIN مرفوضة (400)', esc.status === 400, esc.status);
check('تكرار التسجيل → 409', (await call('POST', '/auth/register', { json: { fullName: 'x', username: `ya_${run}`, email: `ya_${run}@t.io`, password: 'Passw0rd!!' } })).status === 409);
check('كلمة مرور خاطئة → 401', (await call('POST', '/auth/login', { json: { identifier: `ya_${run}`, password: 'wrong' } })).status === 401);

const adminT = await login(ADMIN.identifier, ADMIN.password);
check('login للأدمن (seed)', !!adminT.accessToken, JSON.stringify(adminT));
const admin = adminT.accessToken;

console.log('\n[2] الأدوار والـ Guards');
check('بدون توكن → 401', (await call('POST', '/instructor/programs', { json: {} })).status === 401);
check('Youth على مسار المشرف → 403', (await call('POST', '/instructor/programs', { token: A.token, json: { title: 't', description: 'd', totalSeats: 1 } })).status === 403);
check('Youth على مسار الأدمن → 403', (await call('POST', '/admin/instructors', { token: A.token, json: {} })).status === 403);
const instrU = `ins_${run}`;
const mk = await call('POST', '/admin/instructors', { token: admin, json: { fullName: 'Instructor', username: instrU, email: `${instrU}@t.io`, password: 'Passw0rd!!' } });
check('الأدمن ينشئ مشرفاً بدور INSTRUCTOR', mk.status === 201 && mk.data.role === 'INSTRUCTOR', JSON.stringify(mk.data));
const I = (await login(instrU, 'Passw0rd!!')).accessToken;
const instr2U = `ins2_${run}`;
await call('POST', '/admin/instructors', { token: admin, json: { fullName: 'Other', username: instr2U, email: `${instr2U}@t.io`, password: 'Passw0rd!!' } });
const I2 = (await login(instr2U, 'Passw0rd!!')).accessToken;

console.log('\n[3] برامج وجلسات وكاش');
const prog = await call('POST', '/instructor/programs', { token: I, json: { title: `Node ${run}`, description: 'تدريب Node.js', totalSeats: 1 } });
check('المشرف ينشئ برنامجاً', prog.status === 201 && prog.data.availableSeats === 1, JSON.stringify(prog.data));
const pid = prog.data.id;
check('إضافة جلسة لبرنامجه', (await call('POST', `/instructor/programs/${pid}/sessions`, { token: I, json: { date: '2026-12-01T10:00:00Z', locationOrLink: 'https://meet.example/x' } })).status === 201);
check('مشرف آخر لا يضيف جلسة لبرنامجي → 403', (await call('POST', `/instructor/programs/${pid}/sessions`, { token: I2, json: { date: '2026-12-01T10:00:00Z', locationOrLink: 'x' } })).status === 403);
const list1 = await call('GET', `/programs?search=Node ${run}`);
check('GET /programs عام + بحث', list1.status === 200 && list1.data.data.length === 1 && list1.data.meta.total === 1);
check('الصفحة تتجاوز الحد → 400', (await call('GET', '/programs?limit=1000')).status === 400);
const detail = await call('GET', `/programs/${pid}`);
check('تفاصيل البرنامج عامة وفيها الجلسات وبدون materials', detail.status === 200 && detail.data.sessions.length === 1 && !('materials' in detail.data));

console.log('\n[4] المواد (رفع + حماية)');
const mf = new FormData(); mf.set('title', 'ملف الأسبوع الأول'); mf.set('file', new Blob(['%PDF-1.4 material'], { type: 'application/pdf' }), 'week1.pdf');
const mat = await call('POST', `/instructor/programs/${pid}/materials`, { token: I, form: mf });
check('رفع مادة بواسطة المشرف', mat.status === 201, JSON.stringify(mat.data));
const bad = new FormData(); bad.set('title', 'x'); bad.set('file', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'a.exe');
check('رفع .exe مرفوض (400)', (await call('POST', `/instructor/programs/${pid}/materials`, { token: I, form: bad })).status === 400);
const mf2 = new FormData(); mf2.set('title', 'x'); mf2.set('file', new Blob(['%PDF'], { type: 'application/pdf' }), 'a.pdf');
check('مشرف آخر لا يرفع لبرنامجي → 403', (await call('POST', `/instructor/programs/${pid}/materials`, { token: I2, form: mf2 })).status === 403);

console.log('\n[5] التقديم والمقاعد');
const fake = await apply(A.token, pid, new Blob(['not a pdf at all'], { type: 'application/pdf' }));
check('ملف بامتداد/نوع PDF لكن محتواه ليس PDF → 400', fake.status === 400, JSON.stringify(fake.data));
check('تقديم بدون ملف → 400', (await apply(A.token, pid, null)).status === 400);
check('المشرف لا يقدّم على برنامج → 403', (await apply(I, pid)).status === 403);
const a1 = await apply(A.token, pid);
check('A يقدّم ويحجز المقعد (PENDING)', a1.status === 201 && a1.data.status === 'PENDING', JSON.stringify(a1.data));
check('تقديم مكرر → 409', (await apply(A.token, pid)).status === 409);
check('B: المقاعد ممتلئة → 400', (await apply(B.token, pid)).status === 400);
const listAfter = await call('GET', `/programs?search=Node ${run}`);
check('الكاش يُبطَل: availableSeats = 0 فوراً', listAfter.data.data[0].availableSeats === 0, listAfter.data.data[0].availableSeats);
check('طلبات A: لا تحتوي مواد', !JSON.stringify((await call('GET', '/applications/my', { token: A.token })).data).includes('filePath'));
check('A (PENDING) لا يرى المواد → 403', (await call('GET', `/programs/${pid}/materials`, { token: A.token })).status === 403);

console.log('\n[6] مراجعة الأدمن');
check('Youth لا يراجع → 403', (await call('PATCH', `/admin/applications/${a1.data.id}`, { token: A.token, json: { status: 'ACCEPTED' } })).status === 403);
check('حالة غير صالحة → 400', (await call('PATCH', `/admin/applications/${a1.data.id}`, { token: admin, json: { status: 'CANCELLED' } })).status === 400);
const acc = await call('PATCH', `/admin/applications/${a1.data.id}`, { token: admin, json: { status: 'ACCEPTED' } });
check('الأدمن يقبل الطلب', acc.status === 200 && acc.data.status === 'ACCEPTED' && acc.data.reviewedById, JSON.stringify(acc.data));
check('مراجعة مكررة → 400', (await call('PATCH', `/admin/applications/${a1.data.id}`, { token: admin, json: { status: 'REJECTED' } })).status === 400);
const ml = await call('GET', `/programs/${pid}/materials`, { token: A.token });
check('A (ACCEPTED) يرى المواد', ml.status === 200 && ml.data.length === 1, JSON.stringify(ml.data));
const dl = await call('GET', `/programs/${pid}/materials/${ml.data[0].id}/download`, { token: A.token });
check('A يحمّل الملف', dl.status === 200 && Buffer.isBuffer(dl.data) && dl.data.toString().startsWith('%PDF'));
check('C (غير مقدّم) لا يحمّل → 403', (await call('GET', `/programs/${pid}/materials/${ml.data[0].id}/download`, { token: C.token })).status === 403);
check('بدون توكن لا يحمّل → 401', (await call('GET', `/programs/${pid}/materials/${ml.data[0].id}/download`)).status === 401);

console.log('\n[7] الإعلانات');
check('المشرف ينشر إعلان برنامجه', (await call('POST', `/instructor/programs/${pid}/announcements`, { token: I, json: { title: 'خاص', content: 'للمقبولين' } })).status === 201);
check('مشرف آخر لا ينشر إعلاناً لبرنامجي → 403', (await call('POST', `/instructor/programs/${pid}/announcements`, { token: I2, json: { title: 'x', content: 'y' } })).status === 403);
check('الأدمن ينشر إعلاناً عاماً', (await call('POST', '/admin/announcements', { token: admin, json: { title: 'عام', content: 'للجميع' } })).status === 201);
const annA = (await call('GET', '/announcements/my', { token: A.token })).data;
const annC = (await call('GET', '/announcements/my', { token: C.token })).data;
check('A (مقبول) يرى العام + الخاص', annA.some((x) => x.title === 'خاص') && annA.some((x) => x.title === 'عام'));
check('C يرى العام فقط', annC.some((x) => x.title === 'عام') && !annC.some((x) => x.title === 'خاص'));

console.log('\n[8] الإلغاء وإعادة المقعد');
check('B لا يلغي طلب A → 404', (await call('PATCH', `/applications/${a1.data.id}/cancel`, { token: B.token })).status === 404);
const can = await call('PATCH', `/applications/${a1.data.id}/cancel`, { token: A.token });
check('A يلغي طلبه', can.status === 200 && can.data.status === 'CANCELLED');
check('إلغاء مكرر → 404 (لا إعادة مقعد مرتين)', (await call('PATCH', `/applications/${a1.data.id}/cancel`, { token: A.token })).status === 404);
const seats = (await call('GET', `/programs/${pid}`)).data.availableSeats;
check('المقعد عاد (=1) وليس 2', seats === 1, seats);
const b1 = await apply(B.token, pid);
check('B يقدّم الآن بنجاح', b1.status === 201);
check('A: المقاعد ممتلئة عند إعادة التقديم → 400', (await apply(A.token, pid)).status === 400);
const rej = await call('PATCH', `/admin/applications/${b1.data.id}`, { token: admin, json: { status: 'REJECTED' } });
check('الأدمن يرفض B ويعاد المقعد', rej.status === 200 && (await call('GET', `/programs/${pid}`)).data.availableSeats === 1);
check('B بعد الرفض لا يعيد التقديم → 409', (await apply(B.token, pid)).status === 409);
const a2 = await apply(A.token, pid);
check('A يعيد التقديم بعد الإلغاء (ينجح)', a2.status === 201 && a2.data.id === a1.data.id && a2.data.status === 'PENDING', JSON.stringify(a2.data));

console.log('\n[9] تزامن: 8 شباب على مقعد واحد');
const p2 = (await call('POST', '/instructor/programs', { token: I, json: { title: `Race ${run}`, description: 'd', totalSeats: 1 } })).data.id;
const crowd = await Promise.all(Array.from({ length: 8 }, (_, i) => newYouth(`R${i}`)));
const results = await Promise.all(crowd.map((u) => apply(u.token, p2)));
const okCount = results.filter((r) => r.status === 201).length;
check('نجح تقديم واحد فقط', okCount === 1, results.map((r) => r.status).join(','));
check('المقاعد = 0 وليست سالبة', (await call('GET', `/programs/${p2}`)).data.availableSeats === 0);

console.log('\n[10] الجلسات: refresh / logout');
const rf = await call('POST', '/auth/refresh', { json: { refreshToken: C.refresh } });
check('refresh يعطي توكنات جديدة', rf.status === 200 && rf.data.accessToken && rf.data.refreshToken !== C.refresh);
check('إعادة استخدام refresh قديم → 401 وتُلغى الجلسة', (await call('POST', '/auth/refresh', { json: { refreshToken: C.refresh } })).status === 401);
check('الجلسة الملغاة: refresh الجديد لم يعد صالحاً', (await call('POST', '/auth/refresh', { json: { refreshToken: rf.data.refreshToken } })).status === 401);
const D = await newYouth('D');
check('الوصول قبل logout', (await call('GET', '/applications/my', { token: D.token })).status === 200);
await call('POST', '/auth/logout', { token: D.token });
check('بعد logout يُرفض نفس access token فوراً → 401', (await call('GET', '/applications/my', { token: D.token })).status === 401);

console.log('\n[11] Brute-force (نفس الـ IP)');
const codes = [];
for (let i = 0; i < 7; i++) codes.push((await call('POST', '/auth/login', { json: { identifier: 'nobody', password: 'x' }, ip: '203.0.113.9' })).status);
check('بعد 5 محاولات → 429', codes.slice(0, 5).every((c) => c === 401) && codes.slice(5).every((c) => c === 429), codes.join(','));

console.log(`\nالنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
