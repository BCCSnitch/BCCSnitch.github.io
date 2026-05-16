// Supabase config
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
const SUPABASE_URL = 'https://roqlhnyveyzjriawughf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcWxobnl2ZXl6anJpYXd1Z2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODUwNTQsImV4cCI6MjA3NTM2MTA1NH0.VPie8b5quLIeSc_uEUheJhMXaupJWgxzo3_ib3egMJk'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const accountBtn = document.getElementById('account')
const createForm = document.getElementById('createForm')
const statusEl = document.getElementById('status')
const sidebar = document.getElementById('accountSidebar')
const closeSidebar = document.getElementById('closeSidebar')
const overlay = document.getElementById('overlay')
const logoutBtn = document.getElementById('logout')
const userEmail = document.getElementById('userEmail')
const avatar = document.getElementById('avatar')
const addOptionBtn = document.getElementById('addOptionBtn')
const optionsContainer = document.getElementById('optionsContainer')
const dropdownBtn = document.getElementById('dropdown-btn')
const dropdownMenu = document.getElementById('dropdown-menu')
const dropdownAccount = document.getElementById('dropdown-account')
const deadlineMonth = document.getElementById('deadlineMonth')
const deadlineDay = document.getElementById('deadlineDay')
const formTitle = document.getElementById('formTitle')
const titleLabel = document.getElementById('titleLabel')
const optionsLabel = document.getElementById('optionsLabel')
const titleInput = document.getElementById('title')
const submitBtn = document.getElementById('submitBtn')
const typeButtons = document.querySelectorAll('.type-btn')

let currentUser = null
let optionCount = 2
const requestedType = new URLSearchParams(window.location.search).get('type')
const normalizedRequestedType = requestedType === 'bet' ? 'market' : requestedType
const hasRequestedType = normalizedRequestedType === 'poll' || normalizedRequestedType === 'market'
let creationType = normalizedRequestedType === 'market' ? 'market' : 'poll'
const DRAFT_KEY = 'snitch_create_draft'

const copy = {
  poll: {
    title: 'Details',
    titleLabel: 'Question',
    optionsLabel: 'Options',
    placeholder: 'e.g., Who had the best spirit week outfit?',
    submit: 'Create',
    creating: 'Creating...',
    invalid: 'Provide a question and at least two options.',
    redirect: '/polls/',
    success: 'Created - redirecting...'
  },
  market: {
    title: 'Details',
    titleLabel: 'Question',
    optionsLabel: 'Options',
    placeholder: 'e.g., Who had the best spirit week outfit?',
    submit: 'Create',
    creating: 'Creating...',
    invalid: 'Provide a question and at least two options.',
    redirect: '/market/',
    success: 'Created - redirecting...'
  }
}

function initDatePicker() {
  const currentYear = new Date().getFullYear()

  function updateDays() {
    const month = parseInt(deadlineMonth.value, 10)
    const currentDay = parseInt(deadlineDay.value, 10) || 0
    let daysInMonth = 31

    if (month) {
      daysInMonth = new Date(currentYear, month, 0).getDate()
    }

    while (deadlineDay.options.length > 1) {
      deadlineDay.remove(1)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const opt = document.createElement('option')
      opt.value = d
      opt.textContent = d
      deadlineDay.appendChild(opt)
    }

    if (currentDay > 0) {
      deadlineDay.value = currentDay <= daysInMonth ? currentDay : daysInMonth
    }
  }

  updateDays()

  deadlineMonth?.addEventListener('change', () => {
    updateDays()
    saveDraft()
  })
  deadlineDay?.addEventListener('change', saveDraft)
}

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

  dropdownBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdownBtn.classList.toggle('active')
    dropdownMenu?.classList.toggle('open')
  })

  document.addEventListener('click', (e) => {
    if (!dropdownMenu?.contains(e.target) && !dropdownBtn?.contains(e.target)) {
      dropdownMenu?.classList.remove('open')
      dropdownBtn?.classList.remove('active')
    }
  })

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
      window.location.href = '/'
      return
    }
  } catch (err) {
    console.error('Init error', err)
    window.location.href = '/'
  }
}

function setCreationType(type) {
  creationType = type
  const selectedCopy = copy[creationType]

  typeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === creationType)
  })

  formTitle.textContent = selectedCopy.title
  titleLabel.textContent = selectedCopy.titleLabel
  optionsLabel.textContent = selectedCopy.optionsLabel
  titleInput.placeholder = selectedCopy.placeholder
  submitBtn.textContent = selectedCopy.submit
  statusEl.textContent = ''
  saveDraft()
}

function updateRemoveButtons() {
  const rows = optionsContainer.querySelectorAll('.option-row')
  rows.forEach(row => {
    const btn = row.querySelector('.remove-option-btn')
    btn.style.visibility = rows.length <= 2 ? 'hidden' : 'visible'
  })
}

function addRemoveHandler(btn) {
  btn.addEventListener('click', () => {
    const rows = optionsContainer.querySelectorAll('.option-row')
    if (rows.length > 2) {
      btn.closest('.option-row').remove()
      updateRemoveButtons()
      saveDraft()
    }
  })
}

function addOption(value = '') {
  optionCount++
  const row = document.createElement('div')
  row.className = 'option-row'
  row.innerHTML = `
    <input class="option-input" type="text" placeholder="Option ${optionCount}" required />
    <button type="button" class="remove-option-btn">×</button>
  `
  optionsContainer.appendChild(row)
  const input = row.querySelector('.option-input')
  input.value = value
  input.addEventListener('input', saveDraft)
  addRemoveHandler(row.querySelector('.remove-option-btn'))
  updateRemoveButtons()
  return input
}

function saveDraft() {
  const draft = {
    creationType,
    title: titleInput.value,
    options: Array.from(optionsContainer.querySelectorAll('.option-input')).map(i => i.value),
    deadlineMonth: deadlineMonth.value,
    deadlineDay: deadlineDay.value,
    deadlineHour: document.getElementById('deadlineHour').value,
    deadlineMinute: document.getElementById('deadlineMinute').value,
    deadlineAmPm: document.getElementById('deadlineAmPm').value
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

function restoreDraft() {
  const saved = localStorage.getItem(DRAFT_KEY)
  if (!saved) return

  try {
    const draft = JSON.parse(saved)

    if (!hasRequestedType && (draft.creationType === 'poll' || draft.creationType === 'market' || draft.creationType === 'bet')) {
      creationType = draft.creationType === 'bet' ? 'market' : draft.creationType
    }
    if (draft.title) titleInput.value = draft.title
    if (draft.deadlineMonth) {
      deadlineMonth.value = draft.deadlineMonth
      deadlineMonth.dispatchEvent(new Event('change'))
    }
    if (draft.deadlineDay) deadlineDay.value = draft.deadlineDay
    if (draft.deadlineHour) document.getElementById('deadlineHour').value = draft.deadlineHour
    if (draft.deadlineMinute) document.getElementById('deadlineMinute').value = draft.deadlineMinute
    if (draft.deadlineAmPm) document.getElementById('deadlineAmPm').value = draft.deadlineAmPm

    if (draft.options && draft.options.length > 0) {
      const existingInputs = optionsContainer.querySelectorAll('.option-input')

      draft.options.forEach((val, i) => {
        if (i < existingInputs.length) {
          existingInputs[i].value = val
        } else {
          addOption(val)
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

function buildDeadline() {
  const month = deadlineMonth.value
  const day = deadlineDay.value
  const year = new Date().getFullYear()
  let deadlineHour = parseInt(document.getElementById('deadlineHour').value, 10)
  const deadlineMinute = document.getElementById('deadlineMinute').value.padStart(2, '0')
  const deadlineAmPm = document.getElementById('deadlineAmPm').value

  if (!month || !day || isNaN(deadlineHour) || !deadlineMinute) {
    return null
  }

  if (deadlineAmPm === 'PM' && deadlineHour !== 12) {
    deadlineHour += 12
  } else if (deadlineAmPm === 'AM' && deadlineHour === 12) {
    deadlineHour = 0
  }

  const hour24 = deadlineHour.toString().padStart(2, '0')
  let deadlineDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  let deadline = new Date(`${deadlineDate}T${hour24}:${deadlineMinute}:00`)

  if (deadline < new Date()) {
    deadlineDate = `${year + 1}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    deadline = new Date(`${deadlineDate}T${hour24}:${deadlineMinute}:00`)
  }

  return deadline
}

document.querySelectorAll('.remove-option-btn').forEach(addRemoveHandler)
document.querySelectorAll('.option-input').forEach(input => {
  input.addEventListener('input', saveDraft)
})
typeButtons.forEach(btn => {
  btn.addEventListener('click', () => setCreationType(btn.dataset.type))
})
addOptionBtn?.addEventListener('click', () => {
  addOption().focus()
  saveDraft()
})

titleInput?.addEventListener('input', saveDraft)
document.getElementById('deadlineHour')?.addEventListener('input', saveDraft)
document.getElementById('deadlineMinute')?.addEventListener('input', saveDraft)
document.getElementById('deadlineAmPm')?.addEventListener('change', saveDraft)

initDatePicker()
restoreDraft()
setCreationType(creationType)
updateRemoveButtons()

createForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault()
  const selectedCopy = copy[creationType]
  statusEl.textContent = selectedCopy.creating

  const title = titleInput.value.trim()
  const options = Array.from(optionsContainer.querySelectorAll('.option-input')).map(input => input.value.trim()).filter(Boolean)
  const deadline = buildDeadline()

  if (!title || options.length < 2) {
    statusEl.textContent = selectedCopy.invalid
    return
  }

  if (!deadline) {
    statusEl.textContent = 'Please set a complete deadline (date and time).'
    return
  }

  try {
    const table = creationType === 'poll' ? 'polls' : 'bets'
    const optionColumn = creationType === 'poll' ? 'options' : 'outcomes'
    const payload = {
      title,
      [optionColumn]: JSON.stringify(options),
      creator: currentUser.id,
      deadline: deadline.toISOString()
    }

    const { error } = await supabase.from(table).insert(payload).select().single()
    if (error) throw error

    clearDraft()
    statusEl.textContent = selectedCopy.success
    setTimeout(() => window.location.href = selectedCopy.redirect, 800)
  } catch (err) {
    console.error('Create error', err)
    statusEl.textContent = `Error creating ${creationType}.`
  }
})

init()
