// Supabase config
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
const SUPABASE_URL = 'https://roqlhnyveyzjriawughf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcWxobnl2ZXl6anJpYXd1Z2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODUwNTQsImV4cCI6MjA3NTM2MTA1NH0.VPie8b5quLIeSc_uEUheJhMXaupJWgxzo3_ib3egMJk'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const accountBtn = document.getElementById('account')
const createBtn = document.getElementById('createBtn')
const pollsList = document.getElementById('pollsList')
const sidebar = document.getElementById('accountSidebar')
const closeSidebar = document.getElementById('closeSidebar')
const overlay = document.getElementById('overlay')
const logoutBtn = document.getElementById('logout')
const userEmail = document.getElementById('userEmail')
const avatar = document.getElementById('avatar')
const dropdownBtn = document.getElementById('dropdown-btn')
const dropdownMenu = document.getElementById('dropdown-menu')
const dropdownCreate = document.getElementById('dropdown-create')
const dropdownAccount = document.getElementById('dropdown-account')

let currentUser = null
let currentRole = null

async function init() {
  setupSidebarEvents()
  await checkSessionAndInit()
  const { error } = await supabase.rpc('auto_resolve_expired_polls')
  if (error) {
    console.error('Error auto-resolving polls:', error)
  }
  await loadPolls()
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

async function checkSessionAndInit() {
  try {
    const { data } = await supabase.auth.getSession()
    const session = data?.session ?? null
    const user = session?.user ?? null

    if (!user) {
      window.location.href = '/'
      return
    }

    currentUser = user
    userEmail.textContent = user.email
    avatar.src = user.user_metadata?.avatar_url || 'https://placehold.co/80x80'

    const { data: profile } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    currentRole = profile?.role ?? null
    if (currentRole === 'Admin' || currentRole === 'Writer') {
      createBtn.style.display = ''
      if (dropdownCreate) dropdownCreate.style.display = ''
    }
  } catch (err) {
    console.error('Session init error', err)
    window.location.href = '/'
  }
}

async function loadPolls() {
  try {
    pollsList.innerHTML = '<p class="no-results">Loading polls...</p>'

    const [pollsResult, userVotesResult, votesResult] = await Promise.all([
      supabase.from('polls').select('*').order('created_at', { ascending: false }),
      supabase.from('poll_votes').select('*').eq('user_id', currentUser.id),
      supabase.from('poll_votes').select('poll_id, option')
    ])

    if (pollsResult.error) throw pollsResult.error
    if (userVotesResult.error) throw userVotesResult.error
    if (votesResult.error) throw votesResult.error

    const polls = pollsResult.data || []
    const userVotes = userVotesResult.data || []
    const votes = votesResult.data || []

    const voteStats = {}
    votes.forEach(vote => {
      if (!voteStats[vote.poll_id]) voteStats[vote.poll_id] = {}
      voteStats[vote.poll_id][vote.option] = (voteStats[vote.poll_id][vote.option] || 0) + 1
    })

    const userVotesByPoll = {}
    userVotes.forEach(vote => {
      userVotesByPoll[vote.poll_id] = vote
    })

    if (!polls.length) {
      pollsList.innerHTML = '<p class="no-results">No polls yet.</p>'
      return
    }

    pollsList.innerHTML = ''
    polls.forEach(poll => {
      const options = parseOptions(poll.options)
      const deadlineDate = poll.deadline ? new Date(poll.deadline) : null
      const deadlineStr = deadlineDate ? deadlineDate.toLocaleString() : '-'
      const isExpired = deadlineDate && deadlineDate < new Date()
      const status = String(poll.status || (isExpired ? 'closed' : 'open')).toLowerCase()
      const isOpen = status === 'open' && !isExpired
      const isResolved = status === 'resolved'
      const userVote = userVotesByPoll[poll.id] || null
      const pollStats = voteStats[poll.id] || {}
      const totalVotes = Object.values(pollStats).reduce((sum, count) => sum + count, 0)

      // Determine the winning option (highest vote count or explicit winning_option field)
      let winningOption = poll.winning_option || null
      if (!winningOption && isResolved && totalVotes > 0) {
        const maxVotes = Math.max(...options.map(o => pollStats[o] || 0))
        winningOption = options.find(o => (pollStats[o] || 0) === maxVotes)
      }

      const optionsHtml = options.map(option => {
        const count = pollStats[option] || 0
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
        const isUserChoice = userVote?.option === option
        const isWinner = isResolved && winningOption === option
        const canClick = isOpen
        const pillClass = 'outcome-pill' + (isWinner ? ' winner' : '') + (canClick ? ' clickable' : '') + (isUserChoice ? ' user-choice' : '')

        return `<div class="${pillClass}" data-poll-id="${poll.id}" data-option="${escapeHtml(option)}">${escapeHtml(option)}<span class="pill-stats">${pct}%</span></div>`
      }).join('')

      const wrapper = document.createElement('div')
      wrapper.className = 'poll-card'
      wrapper.innerHTML = `
        <div class="poll-header">
          <div class="poll-title">${escapeHtml(poll.title || 'Untitled poll')}</div>
          ${currentRole === 'Admin' ? `<button class="delete-btn" data-id="${poll.id}">Delete</button>` : ''}
        </div>
        <div class="poll-meta">Deadline: ${deadlineStr} · <span class="status-${status}">${status}</span> · ${totalVotes} votes</div>
        ${isResolved ? `<div class="winner-label">Winner: ${escapeHtml(winningOption || 'N/A')}</div>` : ''}
        ${userVote ? `<div class="my-vote">Your vote: <span class="my-vote-tag">${escapeHtml(userVote.option)}</span></div>` : ''}
        <div class="market-outcomes">${optionsHtml}</div>
      `
      pollsList.appendChild(wrapper)
    })

    document.querySelectorAll('.outcome-pill.clickable').forEach(pill => {
      pill.addEventListener('click', async (e) => {
        const pollId = pill.dataset.pollId
        const option = pill.dataset.option

        pill.classList.add('selected')
        pill.style.pointerEvents = 'none'
        pill.style.opacity = '0.7'

        await submitVote(pollId, option)

        pill.classList.remove('selected')
        pill.style.pointerEvents = 'auto'
        pill.style.opacity = '1'
      })
    })

    if (currentRole === 'Admin') {
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation()
          if (!confirm('Delete this poll?')) return
          const pollId = btn.dataset.id
          const votesDelete = await supabase.from('poll_votes').delete().eq('poll_id', pollId)
          if (votesDelete.error) {
            alert('Failed to delete poll votes.')
            return
          }

          const { error } = await supabase.from('polls').delete().eq('id', pollId)
          if (error) {
            alert('Failed to delete poll.')
            return
          }
          loadPolls()
        })
      })
    }
  } catch (err) {
    console.error('Error loading polls', err)
    pollsList.innerHTML = '<p class="no-results">Error loading polls.</p>'
  }
}

async function submitVote(pollId, option) {
  const votePayload = {
    poll_id: pollId,
    user_id: currentUser.id,
    option
  }

  const result = await supabase
    .from('poll_votes')
    .upsert(votePayload, { onConflict: 'poll_id,user_id' })

  if (result.error) {
    console.error('Vote error', result.error)
    alert('Failed to submit vote.')
    return
  }

  await loadPolls()
}

function parseOptions(options) {
  try {
    return JSON.parse(options || '[]')
  } catch (e) {
    return (options || '').split(',').map(option => option.trim()).filter(Boolean)
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

init()
