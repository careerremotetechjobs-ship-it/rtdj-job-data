/*
 * Remote Tech & Design Jobs — static data client for Blogger.
 * No framework, no database, no provider API calls from the browser.
 *
 * Usage:
 *   const jobs = await RTDJJobs.loadCategory('dev');
 *   const results = await RTDJJobs.search('motion designer');
 *   const job = await RTDJJobs.getBySlug('example-job-slug');
 */
(function (global) {
  'use strict';

  const memory = new Map();
  const pending = new Map();
  const manifestPromises = new Map();

  function normalizeBase(baseUrl) {
    return String(baseUrl || '').replace(/\/+$/, '');
  }

  function cacheKey(url) {
    return 'rtdj:v1:' + url;
  }

  async function fetchJson(url) {
    if (memory.has(url)) return memory.get(url);
    if (pending.has(url)) return pending.get(url);

    const request = fetch(url, { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('Job data request failed: ' + response.status);
        return response.json();
      })
      .then(function (data) {
        memory.set(url, data);
        return data;
      })
      .finally(function () {
        pending.delete(url);
      });

    pending.set(url, request);
    return request;
  }

  async function getManifest(baseUrl) {
    const base = normalizeBase(baseUrl);
    if (!manifestPromises.has(base)) manifestPromises.set(base, fetchJson(base + '/manifest.json?refresh=' + Date.now()));
    return manifestPromises.get(base);
  }

  async function getChunks(baseUrl, paths, version) {
    const base = normalizeBase(baseUrl);
    const unique = Array.from(new Set(paths || []));
    return (await Promise.all(unique.map(function (path) {
      return fetchJson(base + '/' + path + (version ? '?v=' + encodeURIComponent(version) : ''));
    }))).flat();
  }

  async function loadSearchIndex(baseUrl) {
    const manifest = await getManifest(baseUrl);
    return getChunks(baseUrl, manifest.searchChunks || [], manifest.generatedAt || '');
  }

  async function loadCategory(baseUrl, category) {
    const manifest = await getManifest(baseUrl);
    const paths = (manifest.categoryChunks || {})[category] || [];
    return getChunks(baseUrl, paths, manifest.generatedAt || '');
  }

  async function getBySlug(baseUrl, slug) {
    const manifest = await getManifest(baseUrl);
    const search = await getChunks(baseUrl, manifest.searchChunks || [], manifest.generatedAt || '');
    const meta = search.find(function (job) { return job.slug === slug; });
    if (!meta) return null;
    const paths = (manifest.fullJobChunks || {})[meta.category] || [];
    const jobs = await getChunks(baseUrl, paths, manifest.generatedAt || '');
    return jobs.find(function (job) { return job.slug === slug; }) || null;
  }

  function score(job, query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return 0;
    const fields = [
      ['title', 8], ['company', 5], ['category', 4], ['tags', 3],
      ['region', 2], ['workplaceType', 2], ['type', 1]
    ];
    let total = 0;
    for (const [field, weight] of fields) {
      const value = Array.isArray(job[field]) ? job[field].join(' ') : String(job[field] || '');
      const haystack = value.toLowerCase();
      if (!haystack) continue;
      if (haystack === q) total += weight * 4;
      else if (haystack.includes(q)) total += weight;
      for (const token of q.split(/\s+/).filter(Boolean)) {
        if (haystack.includes(token)) total += weight * 0.25;
      }
    }
    return total;
  }

  async function search(baseUrl, query, options) {
    const opts = options || {};
    const index = await loadSearchIndex(baseUrl);
    const q = String(query || '').trim();
    let rows = index;
    if (opts.category) rows = rows.filter(function (job) { return job.category === opts.category; });
    if (opts.remoteOnly) rows = rows.filter(function (job) { return job.workplaceType === 'remote' || job.verifiedRemote; });
    if (opts.region) rows = rows.filter(function (job) { return String(job.region || '').toLowerCase().includes(String(opts.region).toLowerCase()); });
    if (q) rows = rows.map(function (job) { return { job: job, score: score(job, q) }; }).filter(function (item) { return item.score > 0; }).sort(function (a, b) { return b.score - a.score; }).map(function (item) { return item.job; });
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  }

  global.RTDJJobs = {
    getManifest,
    loadSearchIndex,
    loadCategory,
    getBySlug,
    search,
  };
})(window);
(function () {
  'use strict';
  var DATA_BASE=(window.RTDJ_DATA_BASE_URL||'https://cdn.jsdelivr.net/gh/careerremotetechjobs-ship-it/rtdj-job-data@main/static-data/').replace(/\/$/,'');
  var APP=document.getElementById('rtdj-app'); if(!APP)return;
  var CATS=[['dev','Software Development'],['uiux','UI/UX & Design'],['product','Product'],['aiml','AI / ML'],['data','Data'],['cloud-devops','Cloud & DevOps'],['cybersecurity','Cybersecurity'],['sales-support','Sales & Customer Success'],['leadership','Leadership'],['qa','Quality Assurance'],['marketing','Marketing'],['crypto','Web3 & Crypto'],['it-support','IT Support'],['hardware','Hardware'],['mobile','Mobile Development'],['motion','Motion Design'],['video','Video Editing'],['creative','Creative']];
  function categoryLabel(v){var x=CATS.find(function(c){return c[0]===v});return x?x[1]:String(v||'Other').replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase()})}\n  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function salary(v){if(!v)return'';if(typeof v==='string')return v;if(v.display)return v.display;var cur=v.currency||'USD',min=v.min,max=v.max,p=v.period||'year';if(min==null&&max==null)return'';function m(x){return cur+' '+Number(x).toLocaleString()}return min!=null&&max!=null?m(min)+'–'+m(max)+' / '+p:m(min!=null?min:max)+' / '+p}
  function ago(v){var d=new Date(v).getTime();if(!isFinite(d))return'';var m=Math.max(1,Math.floor((Date.now()-d)/60000));if(m<60)return m+'m ago';var h=Math.floor(m/60);if(h<24)return h+'h ago';var days=Math.floor(h/24);if(days<30)return days+'d ago';return Math.floor(days/30)+'mo ago'}
  function date(v){try{return new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}catch(e){return''}}
  function card(j){var tags=(j.tags||[]).slice(0,4).map(function(t){return'<span>'+esc(t)+'</span>'}).join('');var logo=(j.company||'?').slice(0,2).toUpperCase();return'<article class="rtdj-job-card"><div class="rtdj-job-top"><div class="rtdj-company"><div class="rtdj-logo">'+esc(logo)+'</div><div><strong>'+esc(j.company||'Company')+'</strong><small>'+esc(j.region||j.location||'Global')+'</small></div></div><span class="rtdj-status">Open</span></div><h3>'+esc(j.title||'Untitled role')+'</h3><div class="rtdj-meta"><span>'+esc(j.workplaceType||'Remote / Hybrid')+'</span><span>'+esc(j.type||'Full-time')+'</span>'+(j.salary||j.salaryRange?'<span>'+esc(salary(j.salary||j.salaryRange))+'</span>':'')+'</div><div class="rtdj-tags">'+tags+'</div><div class="rtdj-card-foot"><small>posted '+esc(ago(j.posted||j.createdAt))+'</small><div><button class="rtdj-save" data-save="'+esc(j.slug||'')+'" type="button" aria-label="Save job">♡</button> <a href="/p/job.html?slug='+encodeURIComponent(j.slug||'')+'">View Job →</a></div></div></article>'}
  function shell(title,sub,body,eyebrow){APP.innerHTML='<div class="rtdj-wrap"><div class="rtdj-page-head"><span class="rtdj-eyebrow">'+esc(eyebrow||'Remote Tech & Design Jobs')+'</span><h1>'+esc(title)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div>'+body+'</div>';bindSaves()}
  function err(m){shell('Temporarily unavailable',m,'<div class="rtdj-empty"><a class="rtdj-btn" href="/">Back to homepage</a></div>')}
  async function index(){return window.RTDJJobs.loadSearchIndex(DATA_BASE)}
  async function getJob(slug){return window.RTDJJobs.getBySlug(DATA_BASE,slug)}
  function saved(){try{return JSON.parse(localStorage.getItem('rtdj:saved')||'[]')}catch(e){return[]}}
  function save(slug){var a=saved(),i=a.indexOf(slug);if(i>=0)a.splice(i,1);else a.unshift(slug);try{localStorage.setItem('rtdj:saved',JSON.stringify(a))}catch(e){};return a}
  function bindSaves(){document.querySelectorAll('[data-save]').forEach(function(b){var s=b.getAttribute('data-save');b.textContent=saved().indexOf(s)>=0?'♥':'♡';b.onclick=function(){save(s);b.textContent=saved().indexOf(s)>=0?'♥':'♡'}})}
  function catLinks(){return CATS.map(function(x){return'<a href="/p/jobs.html?category='+x[0]+'"><strong>'+x[1]+'</strong><span>Explore current openings →</span></a>'}).join('')}
  function filter(rows,p){var q=(p.get('q')||'').trim().toLowerCase(),cat=p.get('category')||'',remote=p.get('remote')==='1',region=(p.get('region')||'').toLowerCase();return rows.filter(function(j){if(cat&&j.category!==cat)return false;if(remote&&!(j.workplaceType==='remote'||j.verifiedRemote))return false;if(region&&String(j.region||'').toLowerCase().indexOf(region)<0)return false;if(q){var t=[j.title,j.company,j.category,j.region,j.workplaceType,(j.tags||[]).join(' ')].join(' ').toLowerCase();if(t.indexOf(q)<0)return false}return true})}
  async function home(){if(!DATA_BASE){err('Job data is not configured.');return}var rows=await index(),recent=rows.slice().sort(function(a,b){return new Date(b.posted||0)-new Date(a.posted||0)}).slice(0,6),cats={};rows.forEach(function(j){cats[j.category]=(cats[j.category]||0)+1});var top=Object.keys(cats).sort(function(a,b){return cats[b]-cats[a]}).slice(0,7);APP.innerHTML='<div class="rtdj-hero"><div class="rtdj-wrap"><div class="rtdj-hero-grid"><div><span class="rtdj-eyebrow"><i></i> Live tech careers</span><h1>Find your next <em>remote</em> tech &amp; design role.</h1><p>Curated software, AI, data, design, product, cloud and cybersecurity opportunities from global employers.</p><form id="rtdj-search" class="rtdj-search"><input name="q" placeholder="Search jobs, skills or companies" autocomplete="off"><button>Search jobs</button></form><div class="rtdj-pills"><a href="/p/jobs.html?remote=1">Remote only</a><a href="/p/jobs.html?category=aiml">AI / ML</a><a href="/p/jobs.html?category=dev">Software</a><a href="/p/jobs.html?category=uiux">Design</a></div></div><div class="rtdj-queue"><div class="rtdj-queue-head"><span>Live roles</span><b>'+rows.length+' indexed</b></div>'+top.map(function(c){return'<div><strong>'+esc(categoryLabel(c))+'</strong><span>'+cats[c]+' open</span></div>'}).join('')+'</div></div></div></div><section class="rtdj-section"><div class="rtdj-wrap"><div class="rtdj-section-head"><div><span class="rtdj-eyebrow">Fresh listings</span><h2>Latest jobs</h2></div><a href="/p/jobs.html">Browse all →</a></div><div class="rtdj-grid">'+recent.map(card).join('')+'</div></div></section><section class="rtdj-section rtdj-soft"><div class="rtdj-wrap"><div class="rtdj-section-head"><div><span class="rtdj-eyebrow">Browse by role</span><h2>Popular job categories</h2></div></div><div class="rtdj-category-grid">'+catLinks()+'</div></div></section><section class="rtdj-section"><div class="rtdj-wrap rtdj-info-grid"><div><span class="rtdj-eyebrow">Career intelligence</span><h2>Jobs, salaries and hiring insights in one place.</h2><p>Explore career guides, salary intelligence, company information and technology news alongside live opportunities.</p></div><div class="rtdj-info-links"><a href="/p/salary-insights.html">Salary insights →</a><a href="/p/companies.html">Companies hiring →</a><a href="/p/careers.html">Career guides →</a><a href="/p/news.html">Tech &amp; hiring news →</a></div></div></section>';document.getElementById('rtdj-search').onsubmit=function(e){e.preventDefault();var q=new FormData(e.currentTarget).get('q');location.href='/p/jobs.html?q='+encodeURIComponent(q||'')};bindSaves()}
  async function jobs(){if(!DATA_BASE){err('Job data is not configured.');return}var p=new URLSearchParams(location.search),rows=filter(await index(),p),page=Math.max(1,parseInt(p.get('page')||'1',10)),limit=30,start=(page-1)*limit,total=Math.ceil(rows.length/limit),body='<div class="rtdj-filters"><input id="q" placeholder="Search jobs, skills or companies" value="'+esc(p.get('q')||'')+'"><select id="cat"><option value="">All categories</option>'+CATS.map(function(x){return'<option value="'+x[0]+'" '+(p.get('category')===x[0]?'selected':'')+'>'+x[1]+'</option>'}).join('')+'</select><input id="region" placeholder="Region / country" value="'+esc(p.get('region')||'')+'"><label><input id="remote" type="checkbox" '+(p.get('remote')==='1'?'checked':'')+'> Remote only</label><button id="apply" class="rtdj-btn" type="button">Apply filters</button></div><div class="rtdj-results"><p>'+rows.length+' matching roles · page '+page+' of '+Math.max(1,total)+'</p><div class="rtdj-grid">'+rows.slice(start,start+limit).map(card).join('')+'</div>'+(total>1?'<div class="rtdj-pagination">'+(page>1?'<a href="'+pageUrl(p,page-1)+'">← Previous</a>':'')+(page<total?'<a href="'+pageUrl(p,page+1)+'">Next →</a>':'')+'</div>':'')+'</div>';shell('Browse jobs','Search and filter the current job index without loading full job descriptions.',body);document.getElementById('apply').onclick=function(){var u=new URL(location.href),q=document.getElementById('q').value.trim(),c=document.getElementById('cat').value,r=document.getElementById('region').value.trim(),ro=document.getElementById('remote').checked;q?u.searchParams.set('q',q):u.searchParams.delete('q');c?u.searchParams.set('category',c):u.searchParams.delete('category');r?u.searchParams.set('region',r):u.searchParams.delete('region');ro?u.searchParams.set('remote','1'):u.searchParams.delete('remote');u.searchParams.delete('page');location.href=u.pathname+(u.search?'?'+u.searchParams.toString():'')};}
  function pageUrl(p,n){var u=new URL(location.href);u.searchParams.set('page',n);return u.pathname+'?'+u.searchParams.toString()}
  async function jobPage(){var slug=new URLSearchParams(location.search).get('slug');if(!slug){err('No job was selected.');return}var j=await getJob(slug);if(!j){err('This job is no longer available.');return}shell(j.title||'Job','', '<article class="rtdj-detail"><div class="rtdj-detail-head"><div><span class="rtdj-eyebrow">'+esc(j.category||'Career opportunity')+'</span><h2>'+esc(j.title||'')+'</h2><p><strong>'+esc(j.company||'')+'</strong> · '+esc(j.location||j.region||'Global')+'</p></div><div class="rtdj-detail-actions"><button class="rtdj-save rtdj-save-large" data-save="'+esc(j.slug)+'" type="button">♡ Save</button><a class="rtdj-btn" target="_blank" rel="noopener noreferrer" href="'+esc(j.applyUrl||'#')+'" data-apply="'+esc(j.slug)+'">Apply now →</a></div></div><div class="rtdj-detail-meta">'+[j.workplaceType,j.type,salary(j.salary||j.salaryRange),j.posted?'Posted '+date(j.posted):''].filter(Boolean).map(function(v){return'<span>'+esc(v)+'</span>'}).join('')+'</div><div class="rtdj-description">'+(j.descriptionHtml||esc(j.description||'See the employer application page for full details.'))+'</div></article>');bindSaves();var a=document.querySelector('[data-apply]');if(a)a.onclick=function(){track('job_apply',{job_slug:j.slug,company:j.company})}}
  async function companies(){var rows=await index(),map={};rows.forEach(function(j){var c=(j.company||'Unknown').trim();if(!map[c])map[c]={name:c,jobs:[],categories:{}};map[c].jobs.push(j);map[c].categories[j.category]=(map[c].categories[j.category]||0)+1});var list=Object.keys(map).map(function(k){return map[k]}).sort(function(a,b){return b.jobs.length-a.jobs.length});shell('Companies hiring','Explore employers represented in the current job index. Job counts are generated from live indexed listings.', '<div class="rtdj-company-grid">'+list.slice(0,120).map(function(c){return'<a class="rtdj-company-card" href="/p/company.html?name='+encodeURIComponent(c.name)+'"><div class="rtdj-logo">'+esc(c.name.slice(0,2).toUpperCase())+'</div><div><strong>'+esc(c.name)+'</strong><span>'+c.jobs.length+' indexed role'+(c.jobs.length===1?'':'s')+'</span></div></a>'}).join('')+'</div>')}
  async function companyPage(){var name=new URLSearchParams(location.search).get('name');if(!name){location.href='/p/companies.html';return}var rows=(await index()).filter(function(j){return String(j.company||'').toLowerCase()===String(name).toLowerCase()});if(!rows.length){err('No current indexed jobs were found for this company.');return}shell(rows[0].company,'Current indexed openings and roles by category.', '<div class="rtdj-detail company-profile"><div class="rtdj-company-hero"><div class="rtdj-logo rtdj-logo-xl">'+esc(rows[0].company.slice(0,2).toUpperCase())+'</div><div><h2>'+esc(rows[0].company)+'</h2><p>'+esc(rows[0].region||rows[0].location||'Global')+'</p></div></div><div class="rtdj-grid">'+rows.slice(0,60).map(card).join('')+'</div></div>')}
  async function salaryPage(){var rows=await index(),by={};rows.forEach(function(j){var s=j.salary||j.salaryRange;if(!s)return;var key=j.category||'other';(by[key]||(by[key]=[])).push(salary(s))});var items=Object.keys(by).map(function(k){var vals=by[k].slice(0,8);return'<article class="rtdj-stat-card"><span class="rtdj-eyebrow">'+esc((CATS.find(function(x){return x[0]===k})||[k,k])[1])+'</span><strong>'+vals.length+' salary observations</strong><p>'+vals.map(esc).join(' · ')+'</p></article>'});shell('Salary insights','Salary information shown here is based on salary values supplied by indexed job sources. We do not replace employer-provided values with estimates.','<div class="rtdj-stat-grid">'+(items.join('')||'<div class="rtdj-empty"><p>No salary observations are currently available in the indexed job data.</p></div>')+'</div><div class="rtdj-info-panel"><h2>How to use salary data</h2><p>Compensation can vary by employer, experience, location, employment type and negotiation. Always confirm compensation on the original employer listing.</p></div>')}
  async function salaryTrends(){
    var rows=await index(), withSalary=rows.filter(function(j){return j.salary||j.salaryRange}), dates={};
    withSalary.forEach(function(j){var d=new Date(j.posted||j.createdAt);if(!isNaN(d)){var k=d.toISOString().slice(0,7);dates[k]=(dates[k]||0)+1}});
    var body=Object.keys(dates).sort().slice(-12).map(function(k){
      return '<div class="rtdj-bar"><span>'+k+'</span><div class="rtdj-bar-track"><i></i></div><b>'+dates[k]+'</b></div>';
    }).join('');
    shell('Salary trends','A transparent view of salary-bearing job observations in the indexed dataset. This is not a market-wide compensation estimate.','<div class="rtdj-detail"><h2>Salary-bearing listings over time</h2>'+body+'</div>');
  }

  async function newsOrCareers(type){var label=type==='news'?'news':'career',title=type==='news'?'Technology & hiring news':'Career guides & resources',desc=type==='news'?'Curated technology and hiring stories published on the site.':'Practical career resources for remote tech and design professionals.';try{var u='/feeds/posts/default/-/'+label+'?alt=json&max-results=18',r=await fetch(u,{cache:'no-store'});if(!r.ok)throw 0;var j=await r.json(),entries=(j.feed&&j.feed.entry)||[];var body=entries.map(function(e){var l=(e.link||[]).find(function(x){return x.rel==='alternate'}),html=(e.content&&e.content.$t)||(e.summary&&e.summary.$t)||'',txt=html.replace(/<[^>]+>/g,'').slice(0,180);return'<article class="rtdj-content-card"><span class="rtdj-eyebrow">'+esc(label)+'</span><h2><a href="'+esc(l?l.href:'#')+'">'+esc(e.title.$t)+'</a></h2><p>'+esc(txt)+(txt.length>=180?'…':'')+'</p><small>'+esc(e.published?date(e.published.$t):'')+'</small></article>'}).join('');shell(title,desc,'<div class="rtdj-content-grid">'+(body||'<div class="rtdj-empty"><p>No published '+label+' posts are available yet.</p></div>')+'</div>')}catch(e){shell(title,desc,'<div class="rtdj-empty"><p>Content will appear here as Blogger posts are published under the <strong>'+label+'</strong> label.</p></div>')}}
  function careers(){shell('Career guides','Original career resources, hiring insights and practical guidance for remote technology and digital professionals.','<div class="rtdj-guide-grid"><a class="rtdj-guide-card" href="/search/label/career"><span class="rtdj-eyebrow">Career resources</span><h2>Browse career guides</h2><p>Explore published career advice, resume resources, interview guidance and job-search strategies.</p></a><a class="rtdj-guide-card" href="/p/jobs.html"><span class="rtdj-eyebrow">Jobs</span><h2>Find current openings</h2><p>Search the current indexed remote technology and design opportunities.</p></a><a class="rtdj-guide-card" href="/p/salary-insights.html"><span class="rtdj-eyebrow">Salary</span><h2>Understand compensation</h2><p>Review salary observations and market context alongside current roles.</p></a></div>')}
  function savedJobs(){var ids=saved();if(!ids.length){shell('Saved jobs','Saved locally in this browser — no account or database required.','<div class="rtdj-empty"><h2>No saved jobs yet</h2><p>Use the ♡ button on any job card to save it.</p><a class="rtdj-btn" href="/p/jobs.html">Browse jobs</a></div>');return}index().then(function(rows){var keep=rows.filter(function(j){return ids.indexOf(j.slug)>=0});shell('Saved jobs','Saved locally in this browser — no account or database required.','<div class="rtdj-grid">'+keep.map(card).join('')+'</div>'+(keep.length<ids.length?'<div class="rtdj-info-panel"><p>Some previously saved jobs are no longer in the active index.</p></div>':''))})}
  function savedSearches(){var a=[];try{a=JSON.parse(localStorage.getItem('rtdj:searches')||'[]')}catch(e){}shell('Saved searches','Store your favorite search URLs locally so you can return to them quickly.','<div class="rtdj-detail"><form id="save-search" class="rtdj-search"><input id="search-name" placeholder="Name this search" required><button class="rtdj-btn">Save current search</button></form><div class="rtdj-saved-list">'+(a.length?a.map(function(x,i){return'<div><strong>'+esc(x.name)+'</strong><a href="'+esc(x.url)+'">Open</a><button type="button" data-remove-search="'+i+'">Remove</button></div>'}).join(''):'<p>No saved searches yet.</p>')+'</div></div>');document.getElementById('save-search').onsubmit=function(e){e.preventDefault();var n=document.getElementById('search-name').value.trim();if(!n)return;a.unshift({name:n,url:location.href});try{localStorage.setItem('rtdj:searches',JSON.stringify(a.slice(0,30)))}catch(x){};savedSearches()};document.querySelectorAll('[data-remove-search]').forEach(function(b){b.onclick=function(){a.splice(Number(b.dataset.removeSearch),1);try{localStorage.setItem('rtdj:searches',JSON.stringify(a))}catch(e){};savedSearches()}})}
  function submitJob(){shell('Post a job','Employer listings are reviewed before publication. The Blogger migration keeps the public form lightweight; submission delivery can be connected to your chosen inbox/form endpoint.','<div class="rtdj-detail"><form id="submit-job" class="rtdj-form"><input name="company" required placeholder="Company name"><input name="title" required placeholder="Job title"><input name="location" placeholder="Location / region"><select name="workplace"><option>Remote</option><option>Hybrid</option><option>On-site</option></select><input name="salary" placeholder="Salary (optional)"><input name="apply" type="url" required placeholder="Official application URL"><textarea name="description" rows="8" required placeholder="Job description / responsibilities"></textarea><button class="rtdj-btn">Prepare submission</button><p class="rtdj-form-note">Your submission is prepared locally. Configure an approved form/email endpoint before enabling automatic delivery.</p></form></div>');document.getElementById('submit-job').onsubmit=function(e){e.preventDefault();var f=new FormData(e.currentTarget),txt=['Company: '+f.get('company'),'Role: '+f.get('title'),'Location: '+f.get('location'),'Workplace: '+f.get('workplace'),'Salary: '+f.get('salary'),'Apply: '+f.get('apply'),'','Description:',f.get('description')].join('\n');try{navigator.clipboard.writeText(txt)}catch(x){};alert('Submission details have been prepared. They were copied when browser permissions allow it. Connect the final delivery endpoint before using this form for production submissions.')}}
  function staticPage(title,html){shell(title,'', '<div class="rtdj-detail rtdj-prose">'+html+'</div>')}
  function contact(){staticPage('Contact','<h2>Questions, corrections or employer enquiries</h2><p>For job corrections, broken links, employer enquiries and general feedback, use the contact channel provided by the site owner. Please include the relevant job or company URL when reporting an issue.</p>')}
  function about(){staticPage('About Remote Tech & Design Jobs','<h2>One place for remote careers in tech, design and AI.</h2><p>Remote Tech &amp; Design Jobs brings together remote opportunities, hiring insights, salary information, company information and practical career resources from public and trusted sources.</p><h2>How opportunities are sourced</h2><p>Listings are sourced from public employer career pages and job-data providers. Information may be standardized for readability. Users should always confirm details on the original employer application page.</p><h2>Editorial and commercial disclosure</h2><p>Editorial content is created independently. The site may earn revenue from advertising or affiliate relationships, which do not determine job availability or editorial coverage.</p>')}
  function legal(kind){if(kind==='privacy')staticPage('Privacy Policy','<h2>Information we collect</h2><p>The site may use analytics technologies to understand site usage and improve the service. Saved jobs and saved searches may be stored locally in your browser.</p><h2>Third-party links</h2><p>Job applications and external articles may take you to third-party websites. Their privacy policies and terms apply when you leave this site.</p>');else staticPage('Terms of Use','<h2>Job information</h2><p>Job listings can change, close or be removed without notice. Confirm role details, compensation, eligibility and application requirements with the original employer.</p><h2>Use of the site</h2><p>Use the site for lawful job-search and career research purposes. External links are provided for convenience and may be operated independently of this site.</p>')}
  function track(name,p){try{if(typeof gtag==='function')gtag('event',name,p||{})}catch(e){}}
  var path=location.pathname;
  try{if(path==='/p/jobs.html')jobs();else if(path==='/p/job.html')jobPage();else if(path==='/p/companies.html')companies();else if(path==='/p/company.html')companyPage();else if(path==='/p/salary-insights.html')salaryPage();else if(path==='/p/salary-trends.html')salaryTrends();else if(path==='/p/careers.html')careers();else if(path==='/p/news.html')newsOrCareers('news');else if(path==='/p/saved-jobs.html')savedJobs();else if(path==='/p/saved-searches.html')savedSearches();else if(path==='/p/submit-job.html')submitJob();else if(path==='/p/contact.html')contact();else if(path==='/p/about.html')about();else if(path==='/p/privacy-policy.html')legal('privacy');else if(path==='/p/terms.html')legal('terms');else home()}catch(e){console.error(e);err('Please try again shortly.')}
})();
