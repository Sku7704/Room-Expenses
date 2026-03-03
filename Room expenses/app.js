/**
 * Room Expense Manager - Core Application Logic
 */

// --- State Management ---
const AppState = {
  users: ['Shashikant', 'Kush', 'Law', 'Yashwant'],
  currentUser: null,
  expenses: [],
  theme: 'dark'
};

// Global Chart Instance for proper destruction
let expensesChartObj = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initRouter();
  renderCurrentView();

  // Global event delegation for delete buttons
  document.addEventListener('click', function (e) {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      deleteExpense(id);
    }
  });

  // Global event delegation for settle buttons
  document.addEventListener('click', function (e) {
    const settleBtn = e.target.closest('.btn-settle');
    if (settleBtn) {
      const from = settleBtn.getAttribute('data-from');
      const to = settleBtn.getAttribute('data-to');
      const amount = settleBtn.getAttribute('data-amount');
      settleDebt(from, to, amount, settleBtn);
    }
  });

  // Global event delegation for reset button in settlement
  document.addEventListener('click', function (e) {
    const resetBtn = e.target.closest('#btnResetAllSettled');
    if (resetBtn) {
      resetMonthlyData();
    }
  });

  window.addEventListener('resize', updateNavIndicator);
});

function loadData() {
  const storedExpenses = localStorage.getItem('room_expenses');
  if (storedExpenses) {
    AppState.expenses = JSON.parse(storedExpenses);
  }

  const storedUser = localStorage.getItem('room_current_user');
  if (storedUser) {
    AppState.currentUser = storedUser;
  }

  const storedTheme = localStorage.getItem('room_theme');
  if (storedTheme) {
    AppState.theme = storedTheme;
    document.documentElement.setAttribute('data-theme', AppState.theme);
  }
}

function saveData() {
  localStorage.setItem('room_expenses', JSON.stringify(AppState.expenses));
}

// --- Navigation & Routing ---
function initRouter() {
  const navBtns = document.querySelectorAll('.nav-btn');

  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const viewId = e.currentTarget.getAttribute('data-view');
      navigateTo(viewId);
    });
  });
}

function navigateTo(viewId) {
  // Update Active Button
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Render View
  renderView(viewId);

  // Update Indicator after reflow
  setTimeout(updateNavIndicator, 50);
}

function renderCurrentView() {
  if (!AppState.currentUser) {
    renderView('login');
  } else {
    document.getElementById('appNav').style.display = 'flex';
    document.getElementById('currentUserDisplay').innerHTML = `
          <button onclick="toggleTheme()" class="btn-icon" title="Toggle Theme" style="background:none; border:none; color:var(--text-secondary); cursor:pointer;"><i class="fa-solid fa-moon"></i></button>
          <span style="margin-left: 10px; color:var(--text-secondary);"><i class="fa-solid fa-user"></i> ${AppState.currentUser}</span> 
          <button onclick="logout()" class="btn-icon text-danger" title="Logout" style="background:none; border:none; color:var(--danger); margin-left:5px; cursor:pointer;"><i class="fa-solid fa-sign-out-alt"></i></button>
        `;
    navigateTo('dashboard');
    setTimeout(updateNavIndicator, 150);
  }
}

function updateNavIndicator() {
  const activeBtn = document.querySelector('.nav-btn.active');
  const indicator = document.getElementById('navIndicator');
  const appNav = document.getElementById('appNav');

  if (activeBtn && indicator && appNav.style.display !== 'none') {
    const btnRect = activeBtn.getBoundingClientRect();
    const navRect = appNav.getBoundingClientRect();

    indicator.style.width = `${btnRect.width}px`;
    indicator.style.height = `${btnRect.height}px`;
    indicator.style.left = `${btnRect.left - navRect.left}px`;
    indicator.style.top = `${btnRect.top - navRect.top}px`;
  }
}

// --- Views Rendering ---
function renderView(viewId) {
  const mainContent = document.getElementById('mainContent');
  mainContent.innerHTML = ''; // Clear

  let content = '';

  switch (viewId) {
    case 'login':
      content = getLoginView();
      break;
    case 'dashboard':
      content = getDashboardView();
      break;
    case 'add-expense':
      content = getAddExpenseView();
      break;
    case 'history':
      content = getHistoryView();
      break;
    case 'settlement':
      content = getSettlementView();
      break;
    case 'payments':
      content = getPaymentsView();
      break;
    default:
      content = `<h2>View not found</h2>`;
  }

  mainContent.innerHTML = content;

  // Post-render initialization
  if (viewId === 'dashboard') initDashboardCharts();
  if (viewId === 'add-expense') initAddExpenseForm();
}

// --- View HTML Generators ---

function getLoginView() {
  document.getElementById('appNav').style.display = 'none';
  return `
    <div class="glass-card fade-in" style="max-width: 400px; margin: 4rem auto; text-align: center;">
      <h2 style="margin-bottom: 1.5rem; color: var(--accent-gold);">Welcome Back</h2>
      <p style="margin-bottom: 2rem; color: var(--text-secondary);">Select your profile to continue</p>
      
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${AppState.users.map(user => `
          <button class="btn btn-primary" onclick="login('${user}')" style="width: 100%; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--glass-border);">
            ${user}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function getDashboardView() {
  // Calculate Totals
  const totalExpense = AppState.expenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);

  // Current user contribution (Amount they paid)
  const userPaid = AppState.expenses
    .filter(exp => exp.paidBy === AppState.currentUser)
    .reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);

  // Current user share (Amount they owe)
  let userShare = 0;
  AppState.expenses.forEach(exp => {
    if (exp.splits && exp.splits[AppState.currentUser]) {
      userShare += (parseFloat(exp.splits[AppState.currentUser]) || 0);
    }
  });

  const currentBalance = userPaid - userShare;
  const balanceColor = currentBalance >= 0 ? 'var(--success)' : 'var(--danger)';
  const balanceSign = currentBalance >= 0 ? '+' : '';
  const balanceIcon = currentBalance >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';

  return `
    <div class="fade-in">
      <div class="d-flex justify-between align-center mb-2">
        <h2 style="font-weight: 700; letter-spacing: -0.5px;">Dashboard Overview</h2>
        <div class="d-flex gap-1" id="exportControls">
          <button onclick="exportToPDF()" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem; border-radius: 12px;"><i class="fa-solid fa-file-pdf"></i> PDF</button>
          <button onclick="exportToExcel()" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem; border-radius: 12px;"><i class="fa-solid fa-file-excel"></i> Excel</button>
          <button onclick="resetMonthlyData()" class="btn" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: rgba(255, 71, 87, 0.1); color: var(--danger); border-radius: 12px;"><i class="fa-solid fa-rotate-left"></i> Reset</button>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="stat-card fade-in stagger-1">
          <div class="stat-card-icon"><i class="fa-solid fa-layer-group"></i></div>
          <div class="stat-card-title">Total Group Spending</div>
          <div class="stat-card-value" style="color: var(--accent-gold);">₹${totalExpense.toFixed(2)}</div>
          <small style="color: var(--text-secondary); opacity: 0.8;">Updated just now</small>
        </div>
        
        <div class="stat-card fade-in stagger-2" style="border-color: rgba(46, 213, 115, 0.2);">
          <div class="stat-card-icon" style="color: var(--success);"><i class="fa-solid fa-hand-holding-dollar"></i></div>
          <div class="stat-card-title">Your Total Paid</div>
          <div class="stat-card-value" style="color: var(--success);">₹${userPaid.toFixed(2)}</div>
          <small style="color: var(--text-secondary); opacity: 0.8;">Your contributions</small>
        </div>
        
        <div class="stat-card fade-in stagger-3" style="border-color: ${balanceColor}33;">
          <div class="stat-card-icon" style="color: ${balanceColor};"><i class="fa-solid ${balanceIcon}"></i></div>
          <div class="stat-card-title">Net Balance</div>
          <div class="stat-card-value" style="color: ${balanceColor};">${balanceSign}₹${currentBalance.toFixed(2)}</div>
          <small style="color: var(--text-secondary); opacity: 0.8;">${currentBalance >= 0 ? 'To be received' : 'To be paid'}</small>
        </div>
      </div>

      <div class="glass-card fade-in stagger-4" style="border-radius: var(--border-radius-lg); position: relative;">
        <h3 style="margin-bottom: 1.5rem; font-weight: 600;">Spending Visualizer</h3>
        <div style="height: 350px; display: flex; justify-content: center; position: relative;">
          ${AppState.expenses.length === 0 ? '<p style="align-self: center; color: var(--text-secondary);">No data available yet.</p>' : '<canvas id="expensesChart"></canvas>'}
        </div>
      </div>
    </div>
  `;
}

function getAddExpenseView() {
  const usersChips = AppState.users.map((u, i) => `
    <div class="user-chip ${u === AppState.currentUser ? 'selected' : ''}" data-user="${u}" onclick="selectPayer('${u}')">
      <div class="avatar-placeholder">${u.charAt(0)}</div>
      <span>${u}</span>
    </div>
  `).join('');

  return `
    <div class="fade-in gpay-container">
      
      <form id="addExpenseForm" onsubmit="submitExpense(event)">
        <!-- Giant Amount Input -->
        <div class="gpay-amount-container fade-in stagger-1">
          <span class="gpay-currency">₹</span>
          <input type="number" id="expAmount" class="gpay-amount-input" min="1" step="0.01" placeholder="0" required oninput="resizeInput(this)">
        </div>

        <div class="glass-card fade-in stagger-2" style="border-radius: var(--border-radius-lg);">
          
          <div class="form-group">
            <input type="text" id="expTitle" class="form-control" placeholder="What was this for? (e.g. Dinner, Rent)" style="font-size: 1.1rem; padding: 1rem; border-radius: 12px;" required>
          </div>

          <!-- Who Paid Section -->
          <div class="gpay-section fade-in stagger-3">
            <div class="gpay-section-header">
              <i class="fa-solid fa-wallet"></i> Who paid?
            </div>
            <div class="user-chips-container" id="payerChips">
              ${usersChips}
            </div>
            <input type="hidden" id="expPaidBy" value="${AppState.currentUser}">
          </div>

          <!-- Split Options -->
          <div class="gpay-section fade-in stagger-4">
            <div class="gpay-section-header">
              <i class="fa-solid fa-chart-pie"></i> How to split?
            </div>
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
              <button type="button" class="btn btn-primary split-toggle-btn" id="btnEqualSplit" onclick="setSplitType('equal')" style="flex: 1; padding: 0.5rem; border-radius: 8px;">Equally</button>
              <button type="button" class="btn split-toggle-btn" id="btnCustomSplit" onclick="setSplitType('custom')" style="flex: 1; padding: 0.5rem; border-radius: 8px; background: rgba(255,255,255,0.1); color: var(--text-secondary);">Custom</button>
            </div>
            <input type="hidden" id="expSplitType" value="equal">

            <div id="customSplitContainer">
              <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 0.5rem 1rem;">
                ${AppState.users.map(u => `
                  <div class="custom-split-row">
                    <div class="custom-split-user">
                      <div class="user-chip" style="margin:0; padding: 0.25rem 0.5rem;">
                        <div class="avatar-placeholder">${u.charAt(0)}</div>
                        <span>${u}</span>
                      </div>
                    </div>
                    <div class="custom-split-input-wrapper">
                      <input type="number" class="form-control custom-split-input" data-user="${u}" placeholder="0" min="0" step="0.01">
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="form-group fade-in stagger-4">
            <label class="form-label">Date</label>
            <input type="date" id="expDate" class="form-control" style="border-radius: 12px;" required>
          </div>
          
          <div class="form-group fade-in stagger-4">
            <textarea id="expNotes" class="form-control" rows="2" placeholder="Add a note (optional)..." style="border-radius: 12px; resize: none;"></textarea>
          </div>

          <button type="submit" class="btn btn-primary fade-in stagger-4" style="width: 100%; margin-top: 1rem; padding: 1rem; border-radius: 12px; font-size: 1.1rem; box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);">
            <i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Save Expense
          </button>
        </div>
      </form>
    </div>
  `;
}

function getHistoryView() {
  if (AppState.expenses.length === 0) {
    return `<div class="fade-in">
      <h2 style="margin-bottom: 1.5rem;">Expense History</h2>
      <div class="glass-card text-center">
        <p style="color: var(--text-secondary);">No expenses recorded yet.</p>
      </div>
    </div>`;
  }

  // Filter by date desc AND only actual expenses (not settlements)
  const sorted = AppState.expenses
    .filter(exp => exp.title !== 'Settle Balance')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return `
    <div class="fade-in">
      <div class="d-flex justify-between align-center mb-1">
        <h2>Expense History</h2>
        <!-- Optional Search could go here -->
      </div>
      
      <div class="glass-card table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Category/Notes</th>
              <th>Amount</th>
              <th>Paid By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(exp => `
              <tr>
                <td>${new Date(exp.date).toLocaleDateString()}</td>
                <td style="font-weight: 500;">${exp.title}</td>
                <td style="color: var(--text-secondary); font-size: 0.85rem;">${exp.notes || '-'}</td>
                <td class="text-gold" style="font-weight: 600;">₹${exp.amount.toFixed(2)}</td>
                <td><span class="badge ${exp.paidBy === AppState.currentUser ? 'badge-success' : 'badge-gold'}">${exp.paidBy}</span></td>
                <td>
                  <button type="button" class="delete-btn" data-id="${exp.id}" title="Delete">
                    <i class="fa-regular fa-trash-can" style="pointer-events: none;"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getSettlementView() {
  const transactions = calculateSettlements();

  let html = `
    <div class="fade-in">
      <h2 style="margin-bottom: 1.5rem;">Settlement Summary</h2>
  `;

  if (transactions.length === 0) {
    html += `
      <div class="glass-card text-center fade-in">
        <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
        <h3 style="margin-bottom: 0.5rem;">All settled up!</h3>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">No one owes anything.</p>
        <button id="btnResetAllSettled" class="btn" style="background: var(--danger); color: white; padding: 0.75rem 2rem;">
          <i class="fa-solid fa-trash-can"></i> Clear All History
        </button>
      </div>
    </div>`;
    return html;
  }

  transactions.forEach(t => {
    // Highlight if current user is involved
    const isCurrentUserOwes = t.from === AppState.currentUser;
    const isCurrentUserGets = t.to === AppState.currentUser;
    let cardStyle = "";
    if (isCurrentUserOwes) cardStyle = "border-left-color: var(--danger); background: rgba(255, 71, 87, 0.1);";
    if (isCurrentUserGets) cardStyle = "border-left-color: var(--success); background: rgba(46, 213, 115, 0.1);";

    html += `
      <div class="settlement-card" style="${cardStyle}">
        <div style="flex: 1;">
          <div class="d-flex align-center" style="font-size: 1.05rem;">
            <span style="font-weight: 600; color: ${isCurrentUserOwes ? 'var(--danger)' : 'var(--text-primary)'}">${t.from}</span>
            <span style="color: var(--text-secondary); margin: 0 0.8rem; font-size: 0.9rem;">needs to send</span>
            <span style="font-weight: 600; color: ${isCurrentUserGets ? 'var(--success)' : 'var(--text-primary)'}">${t.to}</span>
          </div>
          <div style="font-weight: 700; color: var(--accent-gold); font-size: 1.25rem;">
            ₹${t.amount.toFixed(2)}
          </div>
        </div>
        ${isCurrentUserOwes || isCurrentUserGets ? `
          <button class="btn-settle" data-from="${t.from}" data-to="${t.to}" data-amount="${t.amount.toFixed(2)}">
            <i class="fa-solid fa-hand-holding-dollar"></i> Pay
          </button>
        ` : ''}
      </div>
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

function getPaymentsView() {
  const settleHistory = AppState.expenses
    .filter(exp => exp.title === 'Settle Balance')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let html = `
    <div class="fade-in">
      <h2 style="margin-bottom: 1.5rem;">Payment History</h2>
  `;

  if (settleHistory.length === 0) {
    html += `
      <div class="glass-card text-center">
        <p style="color: var(--text-secondary);">No payments settled yet.</p>
      </div>
    </div>`;
    return html;
  }

  html += `
    <div class="glass-card table-responsive fade-in stagger-1">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${settleHistory.map(exp => `
            <tr>
              <td>${new Date(exp.date).toLocaleDateString()}</td>
              <td style="font-weight: 500;">${exp.paidBy}</td>
              <td>${Object.keys(exp.splits).find(u => exp.splits[u] > 0)}</td>
              <td class="text-success" style="font-weight: 600;">₹${exp.amount.toFixed(2)}</td>
              <td>
                <button type="button" class="delete-btn" data-id="${exp.id}" title="Delete Payment History">
                  <i class="fa-regular fa-trash-can" style="pointer-events: none;"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
  return html;
}

// --- Actions ---
function login(user) {
  AppState.currentUser = user;
  localStorage.setItem('room_current_user', user);
  renderCurrentView();
}

function logout() {
  AppState.currentUser = null;
  localStorage.removeItem('room_current_user');
  renderCurrentView();
}

function initAddExpenseForm() {
  // Set default date to today
  document.getElementById('expDate').valueAsDate = new Date();

  // Initialize input size
  const amountInput = document.getElementById('expAmount');
  if (amountInput) resizeInput(amountInput);
}

function resizeInput(el) {
  // Simple dynamic resize based on character count
  const val = el.value;
  const chars = val.length > 0 ? val.length : 1;
  const newWidth = chars * 2; // rough em scaling
  el.style.width = `max(60px, ${newWidth}rem)`;
}

function selectPayer(user) {
  document.getElementById('expPaidBy').value = user;

  // Update chips visually
  const chips = document.querySelectorAll('#payerChips .user-chip');
  chips.forEach(chip => {
    if (chip.getAttribute('data-user') === user) {
      chip.classList.add('selected');
    } else {
      chip.classList.remove('selected');
    }
  });
}

function setSplitType(type) {
  document.getElementById('expSplitType').value = type;

  const btnEqual = document.getElementById('btnEqualSplit');
  const btnCustom = document.getElementById('btnCustomSplit');
  const container = document.getElementById('customSplitContainer');

  if (type === 'equal') {
    btnEqual.style.background = 'var(--accent-gold)';
    btnEqual.style.color = '#000';
    btnCustom.style.background = 'rgba(255,255,255,0.1)';
    btnCustom.style.color = 'var(--text-secondary)';
    container.style.display = 'none';
  } else {
    btnCustom.style.background = 'var(--accent-gold)';
    btnCustom.style.color = '#000';
    btnEqual.style.background = 'rgba(255,255,255,0.1)';
    btnEqual.style.color = 'var(--text-secondary)';
    container.style.display = 'block';
  }
}

function submitExpense(e) {
  e.preventDefault();

  const title = document.getElementById('expTitle').value;
  const amount = parseFloat(document.getElementById('expAmount').value);
  const paidBy = document.getElementById('expPaidBy').value;
  const date = document.getElementById('expDate').value;
  const splitType = document.getElementById('expSplitType').value;
  const notes = document.getElementById('expNotes').value;

  let splits = {};

  if (splitType === 'equal') {
    const splitAmount = amount / AppState.users.length;
    AppState.users.forEach(u => { splits[u] = splitAmount; });
  } else {
    // Custom split validation
    let sum = 0;
    const inputs = document.querySelectorAll('.custom-split-input');
    inputs.forEach(input => {
      const val = parseFloat(input.value) || 0;
      const user = input.getAttribute('data-user');
      splits[user] = val;
      sum += val;
    });

    if (Math.abs(sum - amount) > 0.01) {
      alert(`Custom split amounts sum directly to ₹${sum.toFixed(2)}, but total amount is ₹${amount.toFixed(2)}. Please correct.`);
      return;
    }
  }

  const expense = {
    id: Date.now().toString(),
    title,
    amount,
    paidBy,
    date,
    splitType,
    splits,
    notes
  };

  AppState.expenses.push(expense);
  saveData();

  // Show success and redirect
  alert('Expense added successfully!');
  navigateTo('dashboard');
}

function settleDebt(fromUser, toUser, amountText, btnElement) {
  const amount = parseFloat(amountText);
  if (!confirm(`Confirm that ${fromUser} paid ₹${amount} to ${toUser}?`)) return;

  // Animate the card out
  const card = btnElement.closest('.settlement-card');
  if (card) {
    card.classList.add('settled-out');
  }

  // A settling payment means `fromUser` just paid `amount` 
  // exclusively FOR `toUser` (so toUser owes fromUser that amount).
  // This physically moves the balance backwards.

  let splits = {};
  AppState.users.forEach(u => { splits[u] = 0; }); // initialize all zero
  splits[toUser] = amount; // toUser is entirely responsible for this "expense"

  const expense = {
    id: Date.now().toString(),
    title: `Settle Balance`,
    amount: amount,
    paidBy: fromUser,
    date: new Date().toISOString().split('T')[0],
    splitType: 'custom',
    splits: splits,
    notes: `Settlement payment from ${fromUser} to ${toUser} `
  };

  AppState.expenses.push(expense);
  saveData();

  // Wait for animation to finish before rendering again
  setTimeout(() => {
    // Only re-calc if we are still on the settlement tab
    const activeBtn = document.querySelector('.nav-btn.active');
    if (activeBtn && activeBtn.getAttribute('data-view') === 'settlement') {
      renderView('settlement');
    }
  }, 600);
}

function deleteExpense(id) {
  if (confirm("Are you sure you want to delete this?")) {
    const btn = document.querySelector(`.delete - btn[data - id="${id}"]`);
    const row = btn ? btn.closest('tr') : null;

    if (row) {
      row.classList.add('item-deleted');
      setTimeout(() => {
        performDelete(id);
      }, 500);
    } else {
      performDelete(id);
    }
  }
}

function performDelete(id) {
  AppState.expenses = AppState.expenses.filter(e => e.id !== id);
  saveData();

  // Re-render based on current view
  const activeBtn = document.querySelector('.nav-btn.active');
  const currentView = activeBtn ? activeBtn.getAttribute('data-view') : 'dashboard';
  renderView(currentView);

  // Also re-init charts if we were viewing them
  if (expensesChartObj) {
    expensesChartObj.destroy();
    expensesChartObj = null;
    if (currentView === 'dashboard') initDashboardCharts();
  }
}

// --- Settlement Algorithm ---
function calculateSettlements() {
  const balances = {};
  AppState.users.forEach(u => { balances[u] = 0; });

  // Calculate net balances
  AppState.expenses.forEach(exp => {
    const amount = parseFloat(exp.amount) || 0;

    if (balances[exp.paidBy] === undefined) balances[exp.paidBy] = 0;
    // + for the person who paid
    balances[exp.paidBy] += amount;

    // - for everyone's share
    if (exp.splits) {
      for (const [user, share] of Object.entries(exp.splits)) {
        if (balances[user] === undefined) balances[user] = 0;
        balances[user] -= (parseFloat(share) || 0);
      }
    }
  });

  const debtors = [];
  const creditors = [];

  for (const [user, bal] of Object.entries(balances)) {
    if (bal <= -0.01) debtors.push({ user, amount: Math.abs(bal) });      // owes money
    else if (bal >= 0.01) creditors.push({ user, amount: bal }); // is owed money
  }

  // Sort descending
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0; // debtor index
  let j = 0; // creditor index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.001) {
      transactions.push({
        from: debtor.user,
        to: creditor.user,
        amount: amount
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return transactions;
}

// --- Export & Reset Features ---
function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', AppState.theme);
  localStorage.setItem('room_theme', AppState.theme);

  if (expensesChartObj) {
    expensesChartObj.destroy();
    initDashboardCharts(); // Redraw with new theme colors
  }
}

function resetMonthlyData() {
  if (confirm("Are you sure you want to RESET all monthly expenses? This cannot be undone!")) {
    AppState.expenses = [];
    saveData();
    renderExpenseFeed();
    renderView('dashboard');
    alert("Monthly expenses have been reset.");
  }
}

function exportToPDF() {
  // Hide export controls for clean PDF
  const controls = document.getElementById('exportControls');
  if (controls) controls.style.display = 'none';

  const element = document.getElementById('mainContent');
  const opt = {
    margin: 1,
    filename: 'Room_Expense_Report.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  // Create PDF
  html2pdf().set(opt).from(element).save().then(() => {
    if (controls) controls.style.display = 'flex';
  });
}

function exportToExcel() {
  if (AppState.expenses.length === 0) {
    alert("No data to export!");
    return;
  }

  // Create CSV String
  let csvContent = "Date,Title,Category/Notes,Paid By,Amount (Rs),Split Details\n";

  AppState.expenses.forEach(exp => {
    const splitStr = Object.entries(exp.splits).map(([u, s]) => `${u}:${s.toFixed(1)} `).join(' | ');
    const safeTitle = exp.title.replace(/,/g, '');
    const safeNotes = exp.notes.replace(/,/g, '');

    csvContent += `"${exp.date}", "${safeTitle}", "${safeNotes}", "${exp.paidBy}", ${exp.amount.toFixed(2)}, "${splitStr}"\n`;
  });

  // Download Blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Room_Expenses_Data.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- Chart.js Visualization ---
function initDashboardCharts() {
  if (AppState.expenses.length === 0) return;

  const ctx = document.getElementById('expensesChart').getContext('2d');

  if (expensesChartObj) {
    expensesChartObj.destroy();
  }

  // Aggregate by paidBy
  const dataMap = {};
  AppState.expenses.forEach(exp => {
    if (!dataMap[exp.paidBy]) dataMap[exp.paidBy] = 0;
    dataMap[exp.paidBy] += exp.amount;
  });

  const labels = Object.keys(dataMap);
  const data = Object.values(dataMap);

  // Styling based on theme
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();

  expensesChartObj = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: 'Expenses Paid',
        data: data,
        backgroundColor: [
          '#D4AF37', '#2ed573', '#ff4757', '#70a1ff'
        ],
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 2,
        hoverOffset: 15,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            padding: 20,
            font: { size: 12, weight: '500' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function (context) {
              let label = context.label || '';
              if (label) { label += ': '; }
              label += '₹' + context.raw.toFixed(2);
              return label;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}
