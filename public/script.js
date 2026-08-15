// State Management
let currentUser = null;

// DOM Elements
const loginSection = document.getElementById('loginSection');
const employeeSection = document.getElementById('employeeSection');
const adminSection = document.getElementById('adminSection');

const navLogin = document.getElementById('navLogin');
const navEmployee = document.getElementById('navEmployee');
const navAdmin = document.getElementById('navAdmin');
const navLogout = document.getElementById('navLogout');

const loginForm = document.getElementById('loginForm');
const addEmployeeForm = document.getElementById('addEmployeeForm');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnExportAuditLog = document.getElementById('btnExportAuditLog');
const btnLoadAuditMonth = document.getElementById('btnLoadAuditMonth');
const btnLoadArchiveHistory = document.getElementById('btnLoadArchiveHistory');
const btnArchiveNow = document.getElementById('btnArchiveNow');
const auditMonthInput = document.getElementById('auditMonth');
const archiveMonthInput = document.getElementById('archiveMonth');
const btnRefreshAttendance = document.getElementById('btnRefreshAttendance');
const btnLoadAttendanceRecords = document.getElementById('btnLoadAttendanceRecords');
const attendanceDateFilter = document.getElementById('attendanceDateFilter');
const attendanceRecordsContainer = document.getElementById('attendanceRecords');

// Tab buttons
const tabButtons = document.querySelectorAll('.tab-button');
const breakButtons = {
    tea: document.getElementById('btnTea'),
    lunch: document.getElementById('btnLunch'),
    client: document.getElementById('btnClientVisit'),
    safetyDrill: document.getElementById('btnSafetyDrill')
};
let activeBreak = null;

const breakEventTypes = {
    tea: { start: 'tea-break-out', end: 'tea-break-in' },
    lunch: { start: 'lunch-break-out', end: 'lunch-break-in' },
    client: { start: 'client-visit-out', end: 'client-visit-in' },
    safetyDrill: { start: 'safety-drill-out', end: 'safety-drill-in' }
};

const breakLabels = {
    tea: 'Tea Break',
    lunch: 'Lunch Break',
    client: 'Client Visit',
    safetyDrill: 'Safety Drill'
};

// Initialize Log-off
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    
    // Event Listeners
    loginForm.addEventListener('submit', handleLogin);
    addEmployeeForm.addEventListener('submit', handleAddEmployee);
    document.getElementById('showForgotPassword')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForgotPassword(true);
    });
    document.getElementById('showSignup')?.addEventListener('click', (e) => {
        e.preventDefault();
        showSignupSection(true);
    });
    document.getElementById('backToLoginFromForgot')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForgotPassword(false);
    });
    document.getElementById('backToLoginFromSignup')?.addEventListener('click', (e) => {
        e.preventDefault();
        showSignupSection(false);
    });
    document.getElementById('signupForm')?.addEventListener('submit', handleSignup);
    document.getElementById('btnForgotPassword')?.addEventListener('click', handleForgotPassword);
    document.getElementById('btnResetPassword')?.addEventListener('click', handleResetPassword);

    navLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('login');
    });
    
    navEmployee.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('employee');
    });
    
    navAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('admin');
        loadAdminData();
    });

    document.getElementById('employeeSearch')?.addEventListener('input', handleEmployeeSearch);

    if (btnRefreshAttendance) {
        btnRefreshAttendance.addEventListener('click', loadAttendanceRecords);
    } else {
        console.warn('btnRefreshAttendance not found');
    }

    if (btnLoadAttendanceRecords) {
        btnLoadAttendanceRecords.addEventListener('click', loadAttendanceRecords);
    } else {
        console.warn('btnLoadAttendanceRecords not found');
    }
    
    navLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
    
    // Load current user if already logged in
    loadCurrentUser();
    
    // Clock buttons
    document.getElementById('btnClockIn').addEventListener('click', () => recordAttendance('clock-in'));
    document.getElementById('btnClockOut').addEventListener('click', () => recordAttendance('clock-out'));
    document.getElementById('btnTea').addEventListener('click', () => toggleBreak('tea'));
    document.getElementById('btnLunch').addEventListener('click', () => toggleBreak('lunch'));
    document.getElementById('btnClientVisit').addEventListener('click', () => toggleBreak('client'));
    document.getElementById('btnSafetyDrill').addEventListener('click', () => toggleBreak('safetyDrill'));
    updateBreakButtons();
    
    // Tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });

    // Export button
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportEmployeesToExcel);
    }

    // Export audit log button
    if (btnExportAuditLog) {
        btnExportAuditLog.addEventListener('click', exportAuditLogToExcel);
    }

    if (btnLoadAuditMonth) {
        btnLoadAuditMonth.addEventListener('click', () => loadAuditLog());
    }

    if (btnLoadArchiveHistory) {
        btnLoadArchiveHistory.addEventListener('click', () => loadArchiveHistory());
    }

    if (btnArchiveNow) {
        btnArchiveNow.addEventListener('click', triggerArchiveNow);
    }

    if (archiveMonthInput) {
        archiveMonthInput.value = new Date().toISOString().slice(0, 7);
    }

    if (auditMonthInput) {
        auditMonthInput.value = new Date().toISOString().slice(0, 7);
    }
});

// Update Clock
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const clockElement = document.getElementById('currentTime');
    if (clockElement) {
        clockElement.textContent = timeString;
    }
}

function updateBreakButtons() {
    Object.entries(breakButtons).forEach(([key, button]) => {
        if (!button) return;

        const isActive = activeBreak === key;
        button.textContent = isActive ? `${breakLabels[key]} In` : `${breakLabels[key]} Out`;
        button.classList.toggle('btn-warning', isActive);
        button.classList.toggle('btn-secondary', !isActive);
    });
}

function formatAttendanceType(type) {
    const labels = {
        'clock-in': 'Clock In',
        'clock-out': 'Clock Out',
        'tea-break-out': 'Tea Break Out',
        'tea-break-in': 'Tea Break In',
        'lunch-break-out': 'Lunch Break Out',
        'lunch-break-in': 'Lunch Break In',
        'client-visit-out': 'Client Visit Out',
        'client-visit-in': 'Client Visit In',
        'safety-drill-out': 'Safety Drill Out',
        'safety-drill-in': 'Safety Drill In'
    };

    return labels[type] || type;
}

async function toggleBreak(breakType) {
    if (!currentUser) {
        alert('Please log in first');
        return;
    }

    const isEnding = activeBreak === breakType;
    const attendanceType = breakEventTypes[breakType][isEnding ? 'end' : 'start'];
    const label = breakLabels[breakType];

    const success = await recordAttendance(attendanceType);
    if (!success) return;

    activeBreak = isEnding ? null : breakType;
    updateBreakButtons();
    alert(`${label} ${isEnding ? 'ended' : 'started'} successfully`);
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('token', data.token);
            updateCurrentUserUI();
            loginForm.reset();
        } else {
            alert('Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Server may not be running.');
    }
}

function showSignupSection(show) {
    document.getElementById('forgotPasswordSection').style.display = 'none';
    document.getElementById('resetPasswordSection').style.display = 'none';
    document.getElementById('signupSection').style.display = show ? 'block' : 'none';
}

async function handleSignup(e) {
    e.preventDefault();

    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const signupMessage = document.getElementById('signupMessage');

    try {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();
        if (response.ok) {
            signupMessage.style.color = '#065f46';
            signupMessage.textContent = 'Admin account created successfully. Redirecting...';
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateCurrentUserUI();
            showSignupSection(false);
            loginForm.reset();
        } else {
            signupMessage.style.color = '#b91c1c';
            signupMessage.textContent = data.error || 'Unable to create admin account';
        }
    } catch (error) {
        console.error('Signup error:', error);
        signupMessage.style.color = '#b91c1c';
        signupMessage.textContent = 'Signup failed. Server may not be running.';
    }
}

function updateCurrentUserUI() {
    document.getElementById('employeeName').textContent = currentUser.name;
    navLogin.style.display = 'none';
    navLogout.style.display = 'block';
    if (currentUser.role === 'admin') {
        navAdmin.style.display = 'block';
        navEmployee.style.display = 'none';
        showSection('admin');
        loadAdminData();
    } else {
        navEmployee.style.display = 'block';
        navAdmin.style.display = 'none';
        showSection('employee');
        loadEmployeeHistory();
    }
    const companyNameElement = document.getElementById('companyName');
    if (companyNameElement) {
        companyNameElement.textContent = currentUser.companyName || 'Unknown';
    }
    localStorage.setItem('role', currentUser.role);
}

async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        ...(options.headers || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const origin = window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : 'http://localhost:5000';
    const requestUrl = url.startsWith('/api/') ? `${origin}${url}` : url;

    try {
        const response = await fetch(requestUrl, { ...options, headers });
        if (response.status === 401) {
            handleLogout();
            throw new Error('Session expired. Please log in again.');
        }

        return response;
    } catch (error) {
        console.error(`authFetch failed for ${requestUrl}:`, error);
        throw error;
    }
}

async function loadCurrentUser() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const response = await authFetch('/api/auth/me');
        const data = await response.json();
        currentUser = data;
        updateCurrentUserUI();
    } catch (error) {
        console.warn('loadCurrentUser failed:', error);
        localStorage.removeItem('token');
    }
}

function toggleForgotPassword(showReset) {
    const forgotSection = document.getElementById('forgotPasswordSection');
    const resetSection = document.getElementById('resetPasswordSection');
    const loginForm = document.getElementById('loginForm');
    const forgotMessage = document.getElementById('forgotPasswordMessage');
    const resetMessage = document.getElementById('resetPasswordMessage');

    if (showReset) {
        loginForm.style.display = 'none';
        forgotSection.style.display = 'block';
        resetSection.style.display = 'none';
    } else {
        loginForm.style.display = 'block';
        forgotSection.style.display = 'none';
        resetSection.style.display = 'none';
    }

    if (forgotMessage) forgotMessage.textContent = '';
    if (resetMessage) resetMessage.textContent = '';
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const forgotMessage = document.getElementById('forgotPasswordMessage');

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        if (response.ok) {
            forgotMessage.style.color = '#065f46';
            forgotMessage.textContent = `Reset token sent. Token: ${data.resetToken}`;
            document.getElementById('resetPasswordSection').style.display = 'block';
        } else {
            forgotMessage.style.color = '#b91c1c';
            forgotMessage.textContent = data.error || 'Unable to send reset token';
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        forgotMessage.style.color = '#b91c1c';
        forgotMessage.textContent = 'Unable to send reset token';
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const token = document.getElementById('resetToken').value;
    const password = document.getElementById('resetPassword').value;
    const resetMessage = document.getElementById('resetPasswordMessage');

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });

        const data = await response.json();
        if (response.ok) {
            resetMessage.style.color = '#065f46';
            resetMessage.textContent = data.message || 'Password reset successful';
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('forgotPasswordSection').style.display = 'none';
            document.getElementById('resetPasswordSection').style.display = 'none';
        } else {
            resetMessage.style.color = '#b91c1c';
            resetMessage.textContent = data.error || 'Unable to reset password';
        }
    } catch (error) {
        console.error('Reset password error:', error);
        resetMessage.style.color = '#b91c1c';
        resetMessage.textContent = 'Unable to reset password';
    }
}

// Handle Logout
function handleLogout() {
    currentUser = null;
    activeBreak = null;
    localStorage.removeItem('token');
    updateBreakButtons();
    
    const companyNameElement = document.getElementById('companyName');
    if (companyNameElement) {
        companyNameElement.textContent = 'Unknown';
    }
    
    // Reset navigation
    navLogin.style.display = 'block';
    navLogout.style.display = 'none';
    navEmployee.style.display = 'none';
    navAdmin.style.display = 'none';
    
    showSection('login');
}

// Record Attendance
async function recordAttendance(type) {
    if (!currentUser) {
        alert('Please log in first');
        return false;
    }
    
    const timestamp = new Date().toISOString();
    
    try {
        const response = await authFetch('/api/attendance/record', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                employeeId: currentUser.id,
                type: type,
                timestamp: timestamp
            })
        });
        
        if (response.ok) {
            if (type === 'clock-out') {
                activeBreak = null;
                updateBreakButtons();
                alert('Clock out recorded successfully. You have been logged out.');
                handleLogout();
                return true;
            }

            alert(`${formatAttendanceType(type)} recorded successfully`);
            loadEmployeeHistory();
            return true;
        } else {
            alert('Failed to record attendance');
            return false;
        }
    } catch (error) {
        console.error('Attendance error:', error);
        // Fallback: show local record
        const record = `${formatAttendanceType(type)} - ${new Date().toLocaleTimeString()}`;
        showHistoryLocally(record);
        return true;
    }
}

//change:
// Add attendance record
async function addAttendanceRecord(employeeId, type, timestamp, location, notes) {
  const response = await authFetch('/api/attendance/admin/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ employeeId, type, timestamp, location, notes })
  });
  const data = await response.json();
  alert(data.message || 'Record added');
}

// Edit attendance record
async function editAttendanceRecord(recordId, updates) {
  const response = await authFetch(`/api/attendance/admin/edit/${recordId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates)
  });
  const data = await response.json();
  alert(data.message || 'Record updated');
}

// Delete attendance record: change end
async function deleteAttendanceRecord(recordId) {
  const response = await authFetch(`/api/attendance/admin/delete/${recordId}`, {
    method: 'DELETE',
  });
  const data = await response.json();
  alert(data.message || 'Record deleted');
}

// Show History Locally (when server is not available)
function showHistoryLocally(record) {
    const historyList = document.getElementById('attendanceHistory');
    const item = document.createElement('div');
    item.className = 'history-item';
    item.textContent = record;
    historyList.appendChild(item);
}

// Load Employee History
async function loadEmployeeHistory() {
    try {
        const response = await authFetch('/api/attendance/history');
        
        if (response.ok) {
            const data = await response.json();
            const historyList = document.getElementById('attendanceHistory');
            historyList.innerHTML = '';
            
            data.records.forEach(record => {
                const item = document.createElement('div');
                item.className = 'history-item';
                const name = record.employeeId?.name || currentUser?.name || 'Employee';
                item.textContent = `${name}: ${formatAttendanceType(record.type)} - ${new Date(record.timestamp).toLocaleTimeString()}`;
                historyList.appendChild(item);
            });
        }
    } catch (error) {
        console.error('History loading error:', error);
    }
}

// Load Admin Data
async function loadAdminData() {
    loadEmployeeList();
    loadAttendanceRecords();
    loadAuditLog();
}

// Load Employee List
let allEmployees = [];
async function loadEmployeeList() {
    try {
        const response = await authFetch('/api/employees');
        
        if (response.ok) {
            const employees = await response.json();
            allEmployees = employees;
            renderEmployeeList(employees);
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

function renderEmployeeList(employees) {
    const employeeList = document.getElementById('employeeList');
    employeeList.innerHTML = '';

    if (!employees.length) {
        employeeList.innerHTML = '<div style="padding: 1rem; text-align: center; color: #666;">No employees found</div>';
        return;
    }

    employees.forEach(emp => {
        const employeeId = emp._id || emp.id;
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.innerHTML = `
            <h4>${emp.name}</h4>
            <p><strong>Email:</strong> ${emp.email}</p>
            <p><strong>Role:</strong> ${emp.role}</p>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem;">
                <button class="btn btn-secondary" onclick="viewEmployeeDetails('${employeeId}')">View</button>
                <button class="btn btn-danger" onclick="deleteEmployee('${employeeId}')">Remove</button>
            </div>
        `;
        employeeList.appendChild(card);
    });
}

function handleEmployeeSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    if (!query) {
        renderEmployeeList(allEmployees);
        return;
    }

    const filtered = allEmployees.filter(emp =>
        emp.name?.toLowerCase().includes(query) ||
        emp.email?.toLowerCase().includes(query)
    );

    renderEmployeeList(filtered);
}

function viewEmployeeDetails(employeeId) {
    const employee = allEmployees.find(emp => emp._id === employeeId || emp.id === employeeId);
    if (!employee) return;

    alert(`Name: ${employee.name}\nEmail: ${employee.email}\nRole: ${employee.role}`);
}

async function loadAttendanceRecords() {
    try {
        const dateFilter = document.getElementById('attendanceDateFilter')?.value;
        const query = dateFilter ? `?date=${encodeURIComponent(dateFilter)}` : '';
        const response = await authFetch(`/api/attendance/admin/all${query}`);

        if (response.ok) {
            const data = await response.json();
            const attendanceRecords = document.getElementById('attendanceRecords');
            attendanceRecords.innerHTML = '';

            if (!data.records || !data.records.length) {
                attendanceRecords.innerHTML = '<div style="padding: 1rem; text-align: center; color: #666;">No attendance records found</div>';
                return;
            }

            data.records.forEach(record => {
                const entry = document.createElement('div');
                entry.className = 'attendance-item';
                const name = record.employeeId?.name || 'Unknown employee';
                entry.innerHTML = `
                    <h4>${name}</h4>
                    <p><strong>Type:</strong> ${formatAttendanceType(record.type)}</p>
                    <p><strong>Time:</strong> ${record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'}</p>
                    <p><strong>Notes:</strong> ${record.notes || 'None'}</p>
                `;
                attendanceRecords.appendChild(entry);
            });
        } else {
            console.error('Unable to load attendance records');
        }
    } catch (error) {
        console.error('Error loading attendance records:', error);
    }
}

// Load Audit Log
async function loadAuditLog() {
    try {
        const month = auditMonthInput?.value;
        const query = month ? `?month=${encodeURIComponent(month)}` : '';
        const response = await authFetch(`/api/employees/audit${query}`);
        
        if (response.ok) {
            const logs = await response.json();
            const auditLog = document.getElementById('auditLog');
            auditLog.innerHTML = '';
            
            if (logs.length === 0) {
                auditLog.innerHTML = '<div style="padding: 1rem; text-align: center; color: #666;">No audit logs yet</div>';
                return;
            }
            
            logs.forEach(log => {
                const entry = document.createElement('div');
                entry.className = 'audit-entry';
                const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
                const name = log.userName || log.employeeId?.name || log.employeeId?.email || 'Unknown user';
                const userLabel = `${name}${log.userEmail ? ` (${log.userEmail})` : ''}`;
                entry.innerHTML = `
                    <div class="timestamp">${timestamp}</div>
                    <div class="action">${userLabel} - ${log.action} - ${log.details || 'No details'}</div>
                `;
                auditLog.appendChild(entry);
            });
        } else {
            const errorData = await response.json();
            console.error('Audit log error:', errorData);
            const auditLog = document.getElementById('auditLog');
            auditLog.innerHTML = `<div style="padding: 1rem; color: red;">Error: ${errorData.error}</div>`;
        }
    } catch (error) {
        console.error('Error loading audit log:', error);
        const auditLog = document.getElementById('auditLog');
        auditLog.innerHTML = `<div style="padding: 1rem; color: red;">Connection error: ${error.message}</div>`;
    }
}

async function triggerArchiveNow() {
    try {
        const response = await authFetch('/api/employees/audit/archive/trigger', {
            method: 'POST',
        });

        if (response.ok) {
            const result = await response.json();
            alert(`Archive completed. Moved ${result.moved} audit entries.`);
            loadArchiveHistory();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Archive action failed');
        }
    } catch (error) {
        console.error('Archive trigger error:', error);
        alert(error.message || 'Failed to archive logs');
    }
}

async function loadArchiveHistory() {
    try {
        const month = archiveMonthInput?.value;
        const query = month ? `?month=${encodeURIComponent(month)}` : '';
        const response = await authFetch(`/api/employees/audit/archive${query}`);

        if (response.ok) {
            const logs = await response.json();
            const archiveLog = document.getElementById('archiveLog');
            archiveLog.innerHTML = '';

            if (logs.length === 0) {
                archiveLog.innerHTML = '<div style="padding: 1rem; text-align: center; color: #666;">No archived logs found for this period</div>';
                return;
            }

            logs.forEach(log => {
                const entry = document.createElement('div');
                entry.className = 'audit-entry';
                const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
                const name = log.userName || log.employeeId?.name || log.employeeId?.email || 'Unknown user';
                const userLabel = `${name}${log.userEmail ? ` (${log.userEmail})` : ''}`;
                entry.innerHTML = `
                    <div class="timestamp">${timestamp}</div>
                    <div class="action">${userLabel} - ${log.action} - ${log.details || 'No details'}</div>
                `;
                archiveLog.appendChild(entry);
            });
        } else {
            const errorData = await response.json();
            console.error('Archived audit log error:', errorData);
            const archiveLog = document.getElementById('archiveLog');
            archiveLog.innerHTML = `<div style="padding: 1rem; color: red;">Error: ${errorData.error}</div>`;
        }
    } catch (error) {
        console.error('Error loading archived audit log:', error);
        const archiveLog = document.getElementById('archiveLog');
        archiveLog.innerHTML = `<div style="padding: 1rem; color: red;">Connection error: ${error.message}</div>`;
    }
}

// Handle Add Employee
async function handleAddEmployee(e) {
    e.preventDefault();
    
    const name = document.getElementById('newEmployeeName').value;
    const email = document.getElementById('newEmployeeEmail').value;
    const role = document.getElementById('newEmployeeRole').value;
    const password = document.getElementById('newEmployeePassword').value;
    
    try {
        const response = await authFetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                email,
                password,
                role
            })
        });
        
        if (response.ok) {
            alert('Employee added successfully');
            addEmployeeForm.reset();
            loadEmployeeList();
        } else {
            alert('Failed to add employee');
        }
    } catch (error) {
        console.error('Add employee error:', error);
        alert('Error adding employee');
    }
}

// Delete Employee
async function deleteEmployee(employeeId) {
    if (!confirm('Are you sure you want to remove this employee?')) {
        return;
    }
    
    try {
        const response = await authFetch(`/api/employees/${employeeId}`, {
            method: 'DELETE',
        });
        
        if (response.ok) {
            alert('Employee removed successfully');
            loadEmployeeList();
        } else {
            alert('Failed to remove employee');
        }
    } catch (error) {
        console.error('Delete error:', error);
    }
}

// Show Section
function showSection(sectionName) {
    loginSection.classList.remove('active');
    employeeSection.classList.remove('active');
    adminSection.classList.remove('active');
    
    navLogin.classList.remove('active');
    navEmployee.classList.remove('active');
    navAdmin.classList.remove('active');
    
    if (sectionName === 'login') {
        loginSection.classList.add('active');
        navLogin.classList.add('active');
    } else if (sectionName === 'employee') {
        employeeSection.classList.add('active');
        navEmployee.classList.add('active');
    } else if (sectionName === 'admin') {
        adminSection.classList.add('active');
        navAdmin.classList.add('active');
    }
}

// Switch Tab
function switchTab(tabName) {
    // Remove active from all tabs and content
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active to clicked tab and corresponding content
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`${tabName}Tab`);

    if (!tabButton || !tabContent) {
        console.warn(`Tab or content not found for: ${tabName}`);
        return;
    }

    tabButton.classList.add('active');
    tabContent.classList.add('active');

    if (tabName === 'attendance') {
        loadAttendanceRecords();
    } else if (tabName === 'audit') {
        loadAuditLog();
    } else if (tabName === 'archive') {
        loadArchiveHistory();
    } else if (tabName === 'employees') {
        loadEmployeeList();
    }
}

// Export Employees to Excel
async function exportEmployeesToExcel() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Only admins can export employees');
        return;
    }

    try {
        const response = await authFetch('/api/export/employees');

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employees.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Employee export error:', error);
        alert(error.message || 'Failed to export employees');
    }
}

// Export Audit Log to Excel
async function exportAuditLogToExcel() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Only admins can export audit logs');
        return;
    }

    try {
        const month = auditMonthInput?.value;
        const query = month ? `?month=${encodeURIComponent(month)}` : '';
        const response = await authFetch(`/api/export/audit${query}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'audit-log.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Audit log export error:', error);
        alert(error.message || 'Failed to export audit log');
    }
}
