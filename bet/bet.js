// Supabase config
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SUPABASE_URL = 'https://roqlhnyveyzjriawughf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcWxobnl2ZXl6anJpYXd1Z2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODUwNTQsImV4cCI6MjA3NTM2MTA1NH0.VPie8b5quLIeSc_uEUheJhMXaupJWgxzo3_ib3egMJk'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// DOM elements
const accountBtn = document.getElementById('account')
const createBetBtn = document.getElementById('createBetBtn')
const balanceEl = document.getElementById('balance')
const marketsList = document.getElementById('marketsList')
const sidebar = document.getElementById('accountSidebar')
const closeSidebar = document.getElementById('closeSidebar')
const overlay = document.getElementById('overlay')
const logoutBtn = document.getElementById('logout')
const userEmail = document.getElementById('userEmail')
const avatar = document.getElementById('avatar')

let currentUser = null
let currentRole = null

async function init() {
  setupSidebarEvents()
  await checkSessionAndInit()
  await supabase.rpc('auto_resolve_expired_bets')
  await loadMarkets()
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
      createBetBtn.style.display = ''
    }

    await supabase.rpc('initialize_user_balance', { p_user_id: user.id })
    
    const { data: balRow } = await supabase
      .from('user_balances')
      .select('amount')
      .eq('user_id', user.id)
      .single()

    if (balRow) {
      balanceEl.textContent = `$${Number(balRow.amount).toLocaleString()}`
    }
  } catch (err) {
    console.error('Session init error', err)
    window.location.href = '/'
  }
}

async function loadMarkets() {
  try {
    marketsList.innerHTML = '<p class="no-results">Loading markets…</p>'
    
    const [betsResult, userBetsResult, statsResult] = await Promise.all([
      supabase.from('bets').select('*').order('created_at', { ascending: false }),
      supabase.from('user_bets').select('*').eq('user_id', currentUser.id),
      supabase.rpc('get_bet_stats')
    ])
    
    if (betsResult.error) throw betsResult.error

    const data = betsResult.data
    const userBets = userBetsResult.data || []
    const statsData = statsResult.data || []
    
    const betStats = {}
    statsData.forEach(row => {
      if (!betStats[row.bet_id]) betStats[row.bet_id] = {}
      betStats[row.bet_id][row.outcome] = Number(row.bet_count)
    })
    
    const userBetsByMarket = {}
    userBets.forEach(ub => {
      if (!userBetsByMarket[ub.bet_id]) userBetsByMarket[ub.bet_id] = []
      userBetsByMarket[ub.bet_id].push(ub)
    })

    if (!data || !data.length) {
      marketsList.innerHTML = '<p class="no-results">No markets yet.</p>'
      return
    }

    marketsList.innerHTML = ''
    data.forEach(bet => {
      const outcomes = (() => {
        try { return JSON.parse(bet.outcomes || '[]') } catch (e) { return (bet.outcomes || '').split(',').map(s => s.trim()).filter(Boolean) }
      })()

      const deadlineDate = bet.deadline ? new Date(bet.deadline) : null
      const deadlineStr = deadlineDate ? deadlineDate.toLocaleString() : '—'
      const isExpired = deadlineDate && deadlineDate < new Date()
      const status = bet.status || (isExpired ? 'closed' : 'open')
      const isOpen = status === 'open' && !isExpired
      
      const myBets = userBetsByMarket[bet.id] || []
      const myBetsHtml = myBets.length > 0 
        ? `<div class="my-bets">Your bets: ${myBets.map(b => `<span class="my-bet-tag">${escapeHtml(b.outcome)} ($${b.amount})</span>`).join(' ')}</div>`
        : ''

      const wrapper = document.createElement('div')
      wrapper.className = 'market-card'
      
      const marketStats = betStats[bet.id] || {}
      const totalBets = Object.values(marketStats).reduce((sum, c) => sum + c, 0)
      
      const outcomesHtml = outcomes.map(o => {
        const isWinner = status === 'resolved' && bet.winning_outcome === o
        const pillClass = isWinner ? 'outcome-pill winner' : 'outcome-pill' + (isOpen ? ' clickable' : '')
        const count = marketStats[o] || 0
        const pct = totalBets > 0 ? Math.round((count / totalBets) * 100) : 0
        return `<div class="${pillClass}" data-bet-id="${bet.id}" data-outcome="${escapeHtml(o)}">${escapeHtml(o)}${isWinner ? ' ✅' : ''}<span class="pill-stats">${pct}%</span></div>`
      }).join('')

      wrapper.innerHTML = `
        <div class="market-header">
          <div class="market-title">${escapeHtml(bet.title || 'Untitled market')}</div>
          ${currentRole === 'Admin' ? `<button class="delete-btn" data-id="${bet.id}">Delete</button>` : ''}
        </div>
        <div class="market-meta">Deadline: ${deadlineStr} · <span class="status-${status}">${status}</span></div>
        ${status === 'resolved' ? `<div class="winner-label">Winner: ${escapeHtml(bet.winning_outcome || 'N/A')}</div>` : ''}
        ${myBetsHtml}
        <div class="market-outcomes">${outcomesHtml}</div>
        ${isOpen ? `
          <div class="bet-input-row" style="display:none;" data-bet-id="${bet.id}">
            <input type="number" class="bet-amount-input" placeholder="Amount" min="1" />
            <button class="place-bet-btn">Place Bet</button>
            <button class="cancel-bet-btn">Cancel</button>
          </div>
        ` : ''}
      `
      marketsList.appendChild(wrapper)
    })

    document.querySelectorAll('.outcome-pill.clickable').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const betId = pill.dataset.betId
        const outcome = pill.dataset.outcome
        
        pill.closest('.market-card').querySelectorAll('.outcome-pill').forEach(p => p.classList.remove('selected'))
        pill.classList.add('selected')
        
        const inputRow = pill.closest('.market-card').querySelector(`.bet-input-row[data-bet-id="${betId}"]`)
        if (inputRow) {
          inputRow.style.display = 'flex'
          inputRow.dataset.selectedOutcome = outcome
          inputRow.querySelector('.bet-amount-input').focus()
        }
      })
    })

    document.querySelectorAll('.cancel-bet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const inputRow = btn.closest('.bet-input-row')
        inputRow.style.display = 'none'
        inputRow.closest('.market-card').querySelectorAll('.outcome-pill').forEach(p => p.classList.remove('selected'))
      })
    })

    document.querySelectorAll('.place-bet-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const inputRow = btn.closest('.bet-input-row')
        const betId = inputRow.dataset.betId
        const outcome = inputRow.dataset.selectedOutcome
        const amountInput = inputRow.querySelector('.bet-amount-input')
        const amount = parseInt(amountInput.value, 10)

        if (!amount || amount <= 0) {
          return
        }

        btn.disabled = true
        btn.textContent = 'Placing...'

        const { data, error } = await supabase.rpc('place_bet', {
          p_bet_id: betId,
          p_outcome: outcome,
          p_amount: amount
        })

        if (error || !data?.success) {
          btn.disabled = false
          btn.textContent = 'Place Bet'
          return
        }
        
        await loadMarkets()
        
        const { data: balRow } = await supabase
          .from('user_balances')
          .select('amount')
          .eq('user_id', currentUser.id)
          .single()
        if (balRow) {
          balanceEl.textContent = `$${Number(balRow.amount).toLocaleString()}`
        }
      })
    })

    if (currentRole === 'Admin') {
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation()
          if (!confirm('Delete this market?')) return
          const betId = btn.dataset.id
          const { error } = await supabase.from('bets').delete().eq('id', betId)
          if (!error) {
            loadMarkets()
          }
        })
      })
    }
  } catch (err) {
    console.error('Error loading markets', err)
    marketsList.innerHTML = '<p class="no-results">Error loading markets.</p>'
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

init()
