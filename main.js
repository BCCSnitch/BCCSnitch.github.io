// Supabase config
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
const SUPABASE_URL = 'https://roqlhnyveyzjriawughf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcWxobnl2ZXl6anJpYXd1Z2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODUwNTQsImV4cCI6MjA3NTM2MTA1NH0.VPie8b5quLIeSc_uEUheJhMXaupJWgxzo3_ib3egMJk'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// DOM elements
const loginBtn = document.getElementById('login')
const accountBtn = document.getElementById('account')
const marketBtn = document.getElementById('market')
const createNewBtn = document.getElementById('writer')
const adminDashboardBtn = document.getElementById('admin')
const logoutBtn = document.getElementById('logout')
const sidebar = document.getElementById('accountSidebar')
const closeSidebar = document.getElementById('closeSidebar')
const userEmail = document.getElementById('userEmail')
const avatar = document.getElementById('avatar')
const newsGrid = document.querySelector('.news-grid')
const heroSection = document.querySelector('.hero')
const trendingList = document.querySelector('.trending ul')
const searchInput = document.querySelector('.search-box input')
const dropdownBtn = document.getElementById('dropdown-btn')
const dropdownMenu = document.getElementById('dropdown-menu')
const dropdownAdmin = document.getElementById('dropdown-admin')
const dropdownMarket = document.getElementById('dropdown-market')
const dropdownAccount = document.getElementById('dropdown-account')

let overlay = document.querySelector('.overlay')
if (!overlay) {
  overlay = document.createElement('div')
  overlay.classList.add('overlay')
  document.body.appendChild(overlay)
}

let allArticles = []
let currentPage = 0
const PAGE_SIZE = 25
let isLoading = false
let hasMore = true

if (newsGrid) newsGrid.innerHTML = '<p class="no-results">Loading articles...</p>'

function setupSidebarEvents() {
  accountBtn?.addEventListener('click', () => {
    sidebar.classList.add('open')
    overlay.classList.add('active')
  })

  closeSidebar?.addEventListener('click', () => {
    sidebar.classList.remove('open')
    overlay.classList.remove('active')
  })

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open')
    overlay.classList.remove('active')
    dropdownMenu?.classList.remove('open')
    dropdownBtn?.classList.remove('active')
  })

  logoutBtn?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      sidebar.classList.remove('open')
      overlay.classList.remove('active')
      location.reload()
    }
  })

  // Dropdown menu toggle
  dropdownBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdownBtn.classList.toggle('active')
    dropdownMenu?.classList.toggle('open')
  })

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdownMenu?.contains(e.target) && !dropdownBtn?.contains(e.target)) {
      dropdownMenu?.classList.remove('open')
      dropdownBtn?.classList.remove('active')
    }
  })

  // Dropdown admin button
  dropdownAdmin?.addEventListener('click', () => {
    window.location.href = '/admin-dashboard/'
  })

  // Dropdown account button - opens sidebar
  dropdownAccount?.addEventListener('click', () => {
    dropdownMenu?.classList.remove('open')
    dropdownBtn?.classList.remove('active')
    sidebar.classList.add('open')
    overlay.classList.add('active')
  })
}

async function checkAuthAndRole() {
  try {
    const { data } = await supabase.auth.getSession()
    const session = data?.session ?? null
    const user = session?.user ?? null

    if (!user) {
      loginBtn.style.display = ''
      accountBtn.style.display = 'none'
      marketBtn.style.display = 'none'
      adminDashboardBtn.style.display = 'none'
      createNewBtn.style.display = 'none'
      // Hide dropdown when not logged in (remove logged-in class)
      if (dropdownBtn) dropdownBtn.classList.remove('logged-in')
      if (dropdownAdmin) dropdownAdmin.style.display = 'none'
      if (dropdownMarket) dropdownMarket.style.display = 'none'
      if (dropdownAccount) dropdownAccount.style.display = 'none'
      return
    }

    loginBtn.style.display = 'none'
    accountBtn.style.display = ''
    marketBtn.style.display = ''
    userEmail.textContent = user.email
    avatar.src = user.user_metadata?.avatar_url || 'https://placehold.co/80x80'
    
    // Show dropdown when logged in (add logged-in class, CSS controls actual display based on size)
    if (dropdownBtn) dropdownBtn.classList.add('logged-in')
    if (dropdownMarket) dropdownMarket.style.display = ''
    if (dropdownAccount) dropdownAccount.style.display = ''

    const { data: profile } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    // Update dropdown admin visibility
    if (profile?.role === 'Admin') {
      if (dropdownAdmin) dropdownAdmin.style.display = ''
    } else {
      if (dropdownAdmin) dropdownAdmin.style.display = 'none'
    }

    // Show admin/writer buttons based on role (CSS handles responsive hiding)
    if (profile?.role === 'Admin') {
      adminDashboardBtn.style.display = ''
      createNewBtn.style.display = ''
    } else if (profile?.role === 'Writer') {
      createNewBtn.style.display = ''
      adminDashboardBtn.style.display = 'none'
    } else {
      adminDashboardBtn.style.display = 'none'
      createNewBtn.style.display = 'none'
    }
  } catch (err) {
    console.error('Error checking session/role:', err)
  }
}

function formattedDate(article) {
  if (!article?.created_at) return ''
  const dateStr = article.created_at.split('T')[0]
  const [year, month, day] = dateStr.split('-')
  return `${month}/${day}/${year}`
}

function extractTitle(html) {
  const temp = document.createElement('div')
  temp.innerHTML = html || ''
  const h1 = temp.querySelector('h1')
  return h1 ? h1.textContent.trim() : 'Untitled'
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getHeroArticle(articles) {
  if(articles.length == 0) {
    return null;
  }
  let daysAgo = 7;
  let hero = null;
  while (!hero) {
    const dateThreshold = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const recentArticles = articles
      .filter(a => a.created_at > dateThreshold)
      .sort((a, b) => (b.visits || 0) - (a.visits || 0));
    hero = recentArticles[0];
    if (!hero) daysAgo += 7; 
  }
  return hero;
}

function getTrending(articles) {
  if(articles.length == 0) {
    return null;
  }
  let monthsAgo = 1;
  let trending = [];
  while (trending.length === 0) {
    const dateThreshold = new Date();
    dateThreshold.setMonth(dateThreshold.getMonth() - monthsAgo);
    const thresholdStr = dateThreshold.toISOString().split('T')[0];
    trending = [...articles]
      .filter(a => a.created_at > thresholdStr)
      .sort((a, b) => (b.visits || 0) - (a.visits || 0))
      .slice(0, 5);
    if (trending.length === 0) monthsAgo += 1; 
  }
  return trending;
}

async function loadPublishedArticles() {
  try {
    if (newsGrid) newsGrid.innerHTML = '<p class="no-results">Loading articles...</p>'

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, html, title_image, image_aspect_ratio, created_at, visits, editors')
      .not('html', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)

    if (error) throw error

    allArticles = articles || []
    currentPage = 1
    hasMore = articles?.length === PAGE_SIZE

    if (!allArticles.length) {
      heroSection.innerHTML = ''
      if (newsGrid) newsGrid.innerHTML = '<p class="no-results">No articles found.</p>'
      return
    }

    const heroArticle = getHeroArticle(allArticles)
    const trending = getTrending(allArticles)

    renderHero(heroArticle)
    renderTrending(trending)

    const remaining = allArticles.filter(a => a.id !== heroArticle.id)
    renderMasonry(remaining)
    
    setupInfiniteScroll()
  } catch (err) {
    console.error('Error loading articles:', err)
    if (newsGrid) newsGrid.innerHTML = '<p class="no-results">Error loading articles.</p>'
    heroSection.innerHTML = ''
  }
}

async function loadMoreArticles() {
  if (isLoading || !hasMore) return
  isLoading = true

  try {
    const start = currentPage * PAGE_SIZE
    const end = start + PAGE_SIZE - 1

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, html, title_image, image_aspect_ratio, created_at, visits, editors')
      .not('html', 'is', null)
      .order('created_at', { ascending: false })
      .range(start, end)

    if (error) throw error

    if (!articles || articles.length === 0) {
      hasMore = false
      return
    }

    hasMore = articles.length === PAGE_SIZE
    currentPage++
    
    allArticles = [...allArticles, ...articles]
    
    const heroArticle = getHeroArticle(allArticles)
    const existingIds = new Set([...newsGrid.querySelectorAll('.news-card')].map(c => c.getAttribute('onclick')?.match(/id=(\d+)/)?.[1]))
    const newArticles = articles.filter(a => a.id !== heroArticle?.id && !existingIds.has(String(a.id)))
    
    if (newArticles.length > 0) {
      appendToMasonry(newArticles)
    }
  } catch (err) {
    console.error('Error loading more articles:', err)
  } finally {
    isLoading = false
  }
}

function setupInfiniteScroll() {
  const container = document.getElementById('outerContainer')
  if (!container) return

  container.addEventListener('scroll', () => {
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    
    if (scrollTop + clientHeight >= scrollHeight - 800) {
      loadMoreArticles()
    }
  })
}

function renderHero(heroArticle) {
  if (!heroArticle) {
    heroSection.innerHTML = ''
    return
  }
  const title = escapeHtml(extractTitle(heroArticle.html))
  const heroImage = heroArticle.title_image || 'https://placehold.co/1200x600?text=No+Image+Available'
  heroSection.innerHTML = `
    <div class="hero-image" onclick="window.location.href='/article-view/?id=${heroArticle.id}'">
      <img src="${heroImage}" alt="${title}">
    </div>
    <div class="hero-text" onclick="window.location.href='/article-view/?id=${heroArticle.id}'">
      <h2>${title}</h2>
      <div class="meta">${heroArticle.editors || "Anonymous"} · ${formattedDate(heroArticle)} · ${heroArticle.visits || 0} views</div>
    </div>
  `
}

function renderTrending(trending) {
  if (!trending || !trending.length) {
    document.querySelector('.trending').style.display = 'none';
    return
  }
  trendingList.innerHTML = trending
    .map((a, i) => `
      <li onclick="window.location.href='/article-view/?id=${a.id}'">
        <span class="trending-number">${i + 1}</span>
        <span class="trending-title">${escapeHtml(extractTitle(a.html))}</span>
        <span class="trending-views">${a.visits || 0} views</span>
      </li>
    `).join('')
}

function renderMasonry(items) {
  if (!newsGrid) return

  newsGrid.innerHTML = ''

  const containerWidth = newsGrid.clientWidth || newsGrid.getBoundingClientRect().width || window.innerWidth
  const COL_MIN = 300 // px minimum desired column width
  const GAP = 24
  let columns = Math.max(1, Math.floor(containerWidth / (COL_MIN + GAP)))
  columns = Math.min(columns, 4)

  const cols = []
  for (let i = 0; i < columns; i++) {
    const col = document.createElement('div')
    col.className = 'news-column'
    newsGrid.appendChild(col)
    cols.push({ el: col, height: 0 })
  }

  const CONTENT_OVERHEAD = 84
  const DEFAULT_RATIO = 0.75 // 4:3 fallback

  const totalGapWidth = GAP * (columns - 1)
  const columnWidth = (containerWidth - totalGapWidth) / columns

  for (const article of items) {
    // Use stored ratio, fallback to default
    const ratio = article.image_aspect_ratio || DEFAULT_RATIO
    const estImgHeight = Math.round(columnWidth * ratio)
    const estimatedCardHeight = estImgHeight + CONTENT_OVERHEAD

    let minIdx = 0
    let minHeight = cols[0].height
    for (let i = 1; i < cols.length; i++) {
      if (cols[i].height < minHeight) {
        minIdx = i
        minHeight = cols[i].height
      }
    }

    const imgSrc = article.title_image || 'https://placehold.co/600x400?text=No+Image'
    const card = document.createElement('div')
    card.className = 'news-card'
    card.setAttribute('role', 'article')
    card.setAttribute('onclick', `window.location.href='/article-view/?id=${article.id}'`)
    card.innerHTML = `
      <div class="card-image">
        <img src="${imgSrc}" alt="${escapeHtml(extractTitle(article.html))}" loading="lazy">
      </div>
      <div class="card-content">
        <h3>${escapeHtml(extractTitle(article.html))}</h3>
        <div class="meta"> ${article.editors || "Anonymous"} · ${formattedDate(article)} · ${article.visits || 0} views</div>
      </div>
    `
    cols[minIdx].el.appendChild(card)
    cols[minIdx].height += estimatedCardHeight
  }
}

function appendToMasonry(items) {
  if (!newsGrid || !items.length) return

  const columns = newsGrid.querySelectorAll('.news-column')
  if (!columns.length) return

  const cols = Array.from(columns).map(el => ({
    el,
    height: el.getBoundingClientRect().height
  }))

  const containerWidth = newsGrid.clientWidth || window.innerWidth
  const GAP = 24
  const totalGapWidth = GAP * (cols.length - 1)
  const columnWidth = (containerWidth - totalGapWidth) / cols.length
  const CONTENT_OVERHEAD = 84
  const DEFAULT_RATIO = 0.75

  for (const article of items) {
    const ratio = article.image_aspect_ratio || DEFAULT_RATIO
    const estImgHeight = Math.round(columnWidth * ratio)
    const estimatedCardHeight = estImgHeight + CONTENT_OVERHEAD

    let minIdx = 0
    let minHeight = cols[0].height
    for (let i = 1; i < cols.length; i++) {
      if (cols[i].height < minHeight) {
        minIdx = i
        minHeight = cols[i].height
      }
    }

    const imgSrc = article.title_image || 'https://placehold.co/600x400?text=No+Image'
    const card = document.createElement('div')
    card.className = 'news-card'
    card.setAttribute('role', 'article')
    card.setAttribute('onclick', `window.location.href='/article-view/?id=${article.id}'`)
    card.innerHTML = `
      <div class="card-image">
        <img src="${imgSrc}" alt="${escapeHtml(extractTitle(article.html))}" loading="lazy">
      </div>
      <div class="card-content">
        <h3>${escapeHtml(extractTitle(article.html))}</h3>
        <div class="meta"> ${article.editors || "Anonymous"} · ${formattedDate(article)} · ${article.visits || 0} views</div>
      </div>
    `
    cols[minIdx].el.appendChild(card)
    cols[minIdx].height += estimatedCardHeight
  }
}

function setupSearch() {
  if (!searchInput) return

  const onInput = () => {
    const query = (searchInput.value || '').trim().toLowerCase()
    if (!query) {
      renderHero(getHeroArticle(allArticles))
      renderTrending(getTrending(allArticles))
      const remaining = allArticles.filter(a => a.id !== getHeroArticle(allArticles).id)
      renderMasonry(remaining)
      return
    }

    heroSection.innerHTML = ''

    const results = allArticles.filter(a => {
      const title = extractTitle(a.html).toLowerCase()
      return title.includes(query)
    })

    if (!results.length) {
      newsGrid.innerHTML = '<p class="no-results">No articles found.</p>'
      return
    }

    renderMasonry(results)
  }

  const deb = debounce(onInput, 120)
  searchInput.addEventListener('input', deb)
}

function debounce(fn, wait = 100) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

const onResizeReflow = debounce(() => {
  const query = (searchInput?.value || '').trim().toLowerCase()
  if (!query) {
    const hero = getHeroArticle(allArticles)
    renderHero(hero)
    renderTrending(getTrending(allArticles))
    const remaining = allArticles.filter(a => a.id !== hero.id)
    renderMasonry(remaining)
  } else {
    const filtered = allArticles.filter(a => {
      const title = extractTitle(a.html).toLowerCase()
      return title.includes(query)
    })
    if (!filtered.length) {
      newsGrid.innerHTML = '<p class="no-results">No articles found.</p>'
    } else {
      renderMasonry(filtered)
    }
  }
}, 180)

window.addEventListener('resize', onResizeReflow)

loginBtn?.addEventListener('click', async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
})

adminDashboardBtn?.addEventListener('click', () => window.location.href = '/admin-dashboard/')
createNewBtn?.addEventListener('click', () => window.location.href = '/drafts-view/')

async function init() {
  setupSidebarEvents()
  // Run auth check and article loading in parallel
  await Promise.all([
    checkAuthAndRole(),
    loadPublishedArticles()
  ])
  setupSearch()
}

init()
