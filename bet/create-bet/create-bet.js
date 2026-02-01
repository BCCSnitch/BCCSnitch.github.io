// Supabase config
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SUPABASE_URL = 'https://roqlhnyveyzjriawughf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcWxobnl2ZXl6anJpYXd1Z2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODUwNTQsImV4cCI6MjA3NTM2MTA1NH0.VPie8b5quLIeSc_uEUheJhMXaupJWgxzo3_ib3egMJk'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// DOM elements
const accountBtn = document.getElementById('account')
const formWrap = document.getElementById('formWrap')
const createForm = document.getElementById('createForm')
const statusEl = document.getElementById('status')
const sidebar = document.getElementById('accountSidebar')
const closeSidebar = document.getElementById('closeSidebar')
const overlay = document.getElementById('overlay')
const logoutBtn = document.getElementById('logout')
const userEmail = document.getElementById('userEmail')
const avatar = document.getElementById('avatar')
const addOptionBtn = document.getElementById('addOptionBtn')
const outcomesContainer = document.getElementById('outcomesContainer')
const dropdownBtn = document.getElementById('dropdown-btn')
const dropdownMenu = document.getElementById('dropdown-menu')
const dropdownAccount = document.getElementById('dropdown-account')
const marketBtn = document.getElementById('marketBtn')

let currentUser = null
let optionCount = 2
const DRAFT_KEY = 'snitch_bet_draft'

function setupSidebarEvents() {
  accountBtn?.addEventListener('click', () => {
    sidebar.classList.add('open')
    overlay.classList.add('active')
  })

  closeSidebar?.addEventListener('click', () => {
    sidebar.classList.remove('open')
    overlay.classList.remove('active')
  })

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open')
    overlay.classList.remove('active')
    dropdownMenu?.classList.remove('open')
    dropdownBtn?.classList.remove('active')
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

  // Dropdown account button - opens sidebar
  dropdownAccount?.addEventListener('click', () => {
    dropdownMenu?.classList.remove('open')
    dropdownBtn?.classList.remove('active')
    sidebar.classList.add('open')
    overlay.classList.add('active')
  })

  logoutBtn?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      sidebar.classList.remove('open')
      overlay.classList.remove('active')
      window.location.href = '/'
    }
  })
}

async function init() {
  setupSidebarEvents()
  try {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user ?? null
    
    if (!user) {
      window.location.href = '/'
      return
    }

    currentUser = user
    userEmail.textContent = user.email
    avatar.src = user.user_metadata?.avatar_url || 'https://placehold.co/80x80'

    const { data: profile } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    const role = profile?.role ?? null
    if (role !== 'Admin' && role !== 'Writer') {
      window.location.href = '/bet/'
      return
    }

  } catch (err) {
    console.error('Init error', err)
    window.location.href = '/bet/'
  }
}

function updateRemoveButtons() {
  const rows = outcomesContainer.querySelectorAll('.option-row')
  rows.forEach(row => {
    const btn = row.querySelector('.remove-option-btn')
    btn.style.visibility = rows.length <= 2 ? 'hidden' : 'visible'
  })
}

function addRemoveHandler(btn) {
  btn.addEventListener('click', () => {
    const rows = outcomesContainer.querySelectorAll('.option-row')
    if (rows.length > 2) {
      btn.closest('.option-row').remove()
      updateRemoveButtons()
    }
  })
}

document.querySelectorAll('.remove-option-btn').forEach(addRemoveHandler)
updateRemoveButtons()

addOptionBtn?.addEventListener('click', () => {
  optionCount++
  const row = document.createElement('div')
  row.className = 'option-row'
  row.innerHTML = `
    <input class="outcome-input" type="text" placeholder="Option ${optionCount}" required />
    <button type="button" class="remove-option-btn">×</button>
  `
  outcomesContainer.appendChild(row)
  addRemoveHandler(row.querySelector('.remove-option-btn'))
  updateRemoveButtons()
  row.querySelector('.outcome-input').focus()
  row.querySelector('.outcome-input').addEventListener('input', saveDraft)
})

function saveDraft() {
  const title = document.getElementById('title').value
  const outcomes = Array.from(outcomesContainer.querySelectorAll('.outcome-input')).map(i => i.value)
  const deadlineDate = document.getElementById('deadlineDate').value
  const deadlineHour = document.getElementById('deadlineHour').value
  const deadlineMinute = document.getElementById('deadlineMinute').value
  const deadlineAmPm = document.getElementById('deadlineAmPm').value
  
  const draft = { title, outcomes, deadlineDate, deadlineHour, deadlineMinute, deadlineAmPm }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

function restoreDraft() {
  const saved = localStorage.getItem(DRAFT_KEY)
  if (!saved) return
  
  try {
    const draft = JSON.parse(saved)
    
    if (draft.title) document.getElementById('title').value = draft.title
    
    if (draft.deadlineDate) document.getElementById('deadlineDate').value = draft.deadlineDate
    if (draft.deadlineHour) document.getElementById('deadlineHour').value = draft.deadlineHour
    if (draft.deadlineMinute) document.getElementById('deadlineMinute').value = draft.deadlineMinute
    if (draft.deadlineAmPm) document.getElementById('deadlineAmPm').value = draft.deadlineAmPm
    
    if (draft.outcomes && draft.outcomes.length > 0) {
      const existingInputs = outcomesContainer.querySelectorAll('.outcome-input')
      
      draft.outcomes.forEach((val, i) => {
        if (i < existingInputs.length) {
          existingInputs[i].value = val
        } else {
          optionCount++
          const row = document.createElement('div')
          row.className = 'option-row'
          row.innerHTML = `
            <input class="outcome-input" type="text" placeholder="Option ${optionCount}" required />
            <button type="button" class="remove-option-btn">×</button>
          `
          outcomesContainer.appendChild(row)
          row.querySelector('.outcome-input').value = val
          addRemoveHandler(row.querySelector('.remove-option-btn'))
          row.querySelector('.outcome-input').addEventListener('input', saveDraft)
        }
      })
      updateRemoveButtons()
    }
  } catch (e) {
    console.error('Error restoring draft', e)
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

document.getElementById('title')?.addEventListener('input', saveDraft)
document.getElementById('deadlineDate')?.addEventListener('change', saveDraft)
document.getElementById('deadlineHour')?.addEventListener('input', saveDraft)
document.getElementById('deadlineMinute')?.addEventListener('input', saveDraft)
document.getElementById('deadlineAmPm')?.addEventListener('change', saveDraft)
document.querySelectorAll('.outcome-input').forEach(input => {
  input.addEventListener('input', saveDraft)
})

restoreDraft()

createForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault()
  statusEl.textContent = 'Creating…'
  const title = document.getElementById('title').value.trim()
  const deadlineDate = document.getElementById('deadlineDate').value
  let deadlineHour = parseInt(document.getElementById('deadlineHour').value, 10)
  const deadlineMinute = document.getElementById('deadlineMinute').value.padStart(2, '0')
  const deadlineAmPm = document.getElementById('deadlineAmPm').value
  
  const outcomeInputs = outcomesContainer.querySelectorAll('.outcome-input')
  const outcomes = Array.from(outcomeInputs).map(input => input.value.trim()).filter(Boolean)

  if (!title || outcomes.length < 2) {
    statusEl.textContent = 'Provide a title and at least two outcomes.'
    return
  }

  if (!deadlineDate || isNaN(deadlineHour) || !deadlineMinute) {
    statusEl.textContent = 'Please set a complete deadline (date and time).'
    return
  }

  if (deadlineAmPm === 'PM' && deadlineHour !== 12) {
    deadlineHour += 12
  } else if (deadlineAmPm === 'AM' && deadlineHour === 12) {
    deadlineHour = 0
  }
  const hour24 = deadlineHour.toString().padStart(2, '0')

  const deadline = new Date(`${deadlineDate}T${hour24}:${deadlineMinute}:00`)

  try {
    const payload = { 
      title, 
      outcomes: JSON.stringify(outcomes), 
      creator: currentUser.id,
      deadline: deadline.toISOString()
    }
    const { data, error } = await supabase.from('bets').insert(payload).select().single()
    if (error) throw error
    clearDraft()
    statusEl.textContent = 'Market created — redirecting to Market…'
    setTimeout(() => window.location.href = '/bet/', 800)
  } catch (err) {
    console.error('Create error', err)
    statusEl.textContent = 'Error creating market.'
  }
})

init()
