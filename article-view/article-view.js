// Supabase config
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
const SUPABASE_URL = 'https://roqlhnyveyzjriawughf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcWxobnl2ZXl6anJpYXd1Z2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODUwNTQsImV4cCI6MjA3NTM2MTA1NH0.VPie8b5quLIeSc_uEUheJhMXaupJWgxzo3_ib3egMJk'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// DOM elements
const titleEl = document.getElementById('title')
const authorEl = document.getElementById('author')
const dateEl = document.getElementById('date')
const viewsEl = document.getElementById('views')
const articleEl = document.getElementById('article')
const bottomHomeBtn = document.getElementById('bottomHomeBtn')
const titleImage = document.getElementById('titleImage')
const deleteArticleBtn = document.getElementById('deleteArticleBtn')
const dropdownDeleteArticleBtn = document.getElementById('dropdown-deleteArticleBtn')
const accountBtn = document.getElementById('account')
const dropdownBtn = document.getElementById('dropdown-btn')
const dropdownMenu = document.getElementById('dropdown-menu')
const dropdownAccount = document.getElementById('dropdown-account')
const logoutBtn = document.getElementById('logout')
const sidebar = document.getElementById('accountSidebar')
const closeSidebar = document.getElementById('closeSidebar')
const userEmail = document.getElementById('userEmail')
const avatar = document.getElementById('avatar')
const overlay = document.getElementById('overlay')

let currentUser = null
let currentArticleId = null

bottomHomeBtn?.addEventListener('click', () => {
  window.location.href = '/'
})

const urlParams = new URLSearchParams(window.location.search)
const articleId = urlParams.get('id')

if (!articleId) {
  titleEl.textContent = 'Article Not Found'
  articleEl.innerHTML = '<p>Invalid or missing article ID.</p>'
  throw new Error('Missing ?id= parameter in URL')
}

async function loadArticle() {
  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .maybeSingle()

    if (error) throw error
    if (!article) {
      titleEl.textContent = 'Article Not Found'
      articleEl.innerHTML = '<p>This article could not be found.</p>'
      return
    }

    currentArticleId = article.id

    const { title, cleanedHtml } = extractAndCleanArticle(article.html)

    titleEl.textContent = title
    authorEl.textContent = `${article.editors || 'Anonymous'}`
    dateEl.textContent = ` · ${new Date(article.created_at).toLocaleDateString()}`
    viewsEl.textContent = ` · ${article.visits || 0} views`
    articleEl.innerHTML = cleanedHtml

    if (article.title_image) {
      titleImage.src = article.title_image
      titleImage.style.display = 'block'
    }

    incrementViews(article.id)

    // Check if current user is admin to render delete button
    await checkAdminAndRenderDelete(article.id)
  } catch (err) {
    console.error('Error loading article:', err)
    articleEl.innerHTML = '<p>Error loading article.</p>'
  }
}

function setupSidebarEvents() {
  accountBtn?.addEventListener('click', () => {
    sidebar?.classList.add('open')
    overlay?.classList.add('active')
  })

  closeSidebar?.addEventListener('click', () => {
    sidebar?.classList.remove('open')
    overlay?.classList.remove('active')
  })

  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open')
    overlay?.classList.remove('active')
    dropdownMenu?.classList.remove('open')
    dropdownBtn?.classList.remove('active')
  })

  logoutBtn?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      sidebar?.classList.remove('open')
      overlay?.classList.remove('active')
      location.reload()
    }
  })

  dropdownBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdownBtn.classList.toggle('active')
    dropdownMenu?.classList.toggle('open')
  })

  dropdownAccount?.addEventListener('click', () => {
    dropdownMenu?.classList.remove('open')
    dropdownBtn?.classList.remove('active')
    sidebar?.classList.add('open')
    overlay?.classList.add('active')
  })

  document.addEventListener('click', (e) => {
    if (!dropdownMenu?.contains(e.target) && !dropdownBtn?.contains(e.target)) {
      dropdownMenu?.classList.remove('open')
      dropdownBtn?.classList.remove('active')
    }
  })
}

async function setupAccountUi() {
  try {
    const { data } = await supabase.auth.getSession()
    const session = data?.session ?? null
    const user = session?.user ?? null

    if (!user) {
      accountBtn.style.display = 'none'
      if (dropdownAccount) dropdownAccount.style.display = 'none'
      return
    }

    accountBtn.style.display = ''
    if (dropdownAccount) dropdownAccount.style.display = ''
    userEmail.textContent = user.email || ''
    avatar.src = user.user_metadata?.avatar_url || 'https://placehold.co/80x80'
  } catch (err) {
    console.error('Error setting account UI', err)
  }
}

function bindDeleteButtons(articleId) {
  const runDelete = async () => {
    const confirmed = confirm(
      '⚠️ Are you sure you want to DELETE this article? This action cannot be undone.'
    )
    if (!confirmed) return

    await deleteArticleImages(articleEl.innerHTML, 'Images', titleImage.src)

    const { error } = await supabase.from('articles').delete().eq('id', articleId)
    if (error) {
      alert('Error deleting article')
      console.error(error)
    } else {
      alert('Article deleted')
      window.location.href = '/'
    }
  }

  deleteArticleBtn?.addEventListener('click', runDelete)
  dropdownDeleteArticleBtn?.addEventListener('click', runDelete)
}

async function incrementViews(id) {
  await supabase.rpc('increment_views', { article_id: parseInt(id) })
}

function extractAndCleanArticle(html) {
  const temp = document.createElement('div')
  temp.innerHTML = html
  const h1 = temp.querySelector('h1')
  const title = h1 ? h1.textContent.trim() : 'Untitled'
  if (h1) h1.remove()
  return { title, cleanedHtml: temp.innerHTML }
}

async function checkAdminAndRenderDelete(articleId) {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData?.session ?? null
    if (!session) return // not logged in, no admin

    currentUser = session.user

    const { data: rolesData, error: rolesErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)

    if (rolesErr || !rolesData) return
    if (!rolesData.some(r => r.role === 'Admin')) return

    if (deleteArticleBtn) deleteArticleBtn.style.display = ''
    if (dropdownDeleteArticleBtn) dropdownDeleteArticleBtn.style.display = ''
    bindDeleteButtons(articleId)
  } catch (err) {
    console.error('Error checking admin role', err)
  }
}

async function deleteArticleImages(html, bucket = 'Images', title_image = null) {
  const pathsToDelete = []

  // Extract paths from HTML content
  if (html) {
    const temp = document.createElement('div')
    temp.innerHTML = html

    const imgElements = Array.from(temp.querySelectorAll('img'))

    imgElements.forEach(img => {
      try {
        const src = img.src || img.getAttribute('src')
        if (!src) return
        
        // Try to extract path from Supabase storage URL
        // Matches patterns like: /storage/v1/object/public/Images/filename.jpg
        // or just /Images/filename.jpg
        const match = src.match(/\/(?:storage\/v1\/object\/public\/)?Images\/(.+?)(?:\?.*)?$/)
        if (match) {
          pathsToDelete.push(decodeURIComponent(match[1]))
        }
      } catch {
        // Skip invalid URLs
      }
    })
  }

  // Handle title image separately
  if (title_image) {
    try {
      const match = title_image.match(/\/(?:storage\/v1\/object\/public\/)?Images\/(.+?)(?:\?.*)?$/)
      if (match) {
        const path = decodeURIComponent(match[1])
        if (!pathsToDelete.includes(path)) {
          pathsToDelete.push(path)
        }
      }
    } catch {
      // Skip invalid title image URL
    }
  }

  if (pathsToDelete.length === 0) {
    console.log('No images to delete')
    return
  }

  console.log('Deleting images:', pathsToDelete)

  // Delete files from Supabase Storage
  const { data, error } = await supabase.storage.from(bucket).remove(pathsToDelete)

  if (error) {
    console.error('Error deleting images from storage:', error)
  } else {
    console.log('Successfully deleted images:', pathsToDelete)
  }
}

setupSidebarEvents()
setupAccountUi()
loadArticle()
