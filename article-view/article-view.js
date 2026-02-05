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
const returnHomeBtn = document.getElementById('returnHome')
const titleImage = document.getElementById('titleImage')
const adminActionsContainer = document.createElement('div')

adminActionsContainer.style.marginTop = '2rem'
articleEl.parentNode.insertBefore(adminActionsContainer, returnHomeBtn)

let currentUser = null

returnHomeBtn.addEventListener('click', () => (window.location.href = '/'))

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

    const deleteBtn = document.createElement('button')
    deleteBtn.textContent = 'Delete Article'
    deleteBtn.className = 'return-btn'
    deleteBtn.style.background = '#dc2626'
    deleteBtn.style.color = '#fff'
    deleteBtn.style.fontSize = '0.9rem'

    deleteBtn.addEventListener('click', async () => {
      const confirmed = confirm(
        '⚠️ Are you sure you want to DELETE this article? This action cannot be undone.'
      )
      if (!confirmed) return
      
      // Delete images first, then delete the article record
      await deleteArticleImages(articleEl.innerHTML, "Images", titleImage.src);

      const { error } = await supabase.from('articles').delete().eq('id', articleId)
      if (error) {
        alert('Error deleting article')
        console.error(error)
      } else {
        alert('Article deleted')
        window.location.href = '/'
      }
    })

    adminActionsContainer.appendChild(deleteBtn)
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

loadArticle()
