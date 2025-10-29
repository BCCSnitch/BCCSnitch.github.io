import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://roqlhnyveyzjriawughf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcWxobnl2ZXl6anJpYXd1Z2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODUwNTQsImV4cCI6MjA3NTM2MTA1NH0.VPie8b5quLIeSc_uEUheJhMXaupJWgxzo3_ib3egMJk'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const titleEl = document.getElementById('title')
const authorEl = document.getElementById('author')
const dateEl = document.getElementById('date')
const viewsEl = document.getElementById('views')
const articleEl = document.getElementById('article')
const returnHomeBtn = document.getElementById('returnHome')
const titleImage = document.getElementById('titleImage')

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
      .from('articles_with_authors')
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
    authorEl.textContent = `By ${article.author_name || 'Anonymous'}`
    dateEl.textContent = ` · ${new Date(article.created_at).toLocaleDateString()}`
    viewsEl.textContent = ` · ${article.visits || 0} views`
    articleEl.innerHTML = cleanedHtml

    // Show title image if available
    if (article.title_image) {
      titleImage.src = article.title_image
      titleImage.style.display = 'block'
    }
    
    incrementViews(article.id)
  } catch (err) {
    console.error('Error loading article:', err)
    articleEl.innerHTML = '<p>Error loading article.</p>'
  }
}

async function incrementViews(id) {
  await supabase.rpc('increment_views', { article_id: parseInt(id) });
}

function extractAndCleanArticle(html) {
  const temp = document.createElement('div')
  temp.innerHTML = html
  const h1 = temp.querySelector('h1')
  const title = h1 ? h1.textContent.trim() : 'Untitled'
  if (h1) h1.remove()
  return { title, cleanedHtml: temp.innerHTML }
}

loadArticle()
