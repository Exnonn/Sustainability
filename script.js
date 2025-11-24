const API_BASE = 'https://gzha067z6j.execute-api.ap-southeast-1.amazonaws.com/Testing';
const BLOCKS = Array.from({ length: 15 }, (_, i) => i + 1);
let records = [];
let editingKey = null;
let currentPage = 1;
let pageSize = 25;
let currentDataType = 'emissions';
let emissionsChart = null;
let missingDataChart = null;
let completenessTrendChart = null;

// -------------------- Initialization --------------------
document.addEventListener('DOMContentLoaded', () => {
    initializeBlocksGrid();
    document.getElementById('dataManagementContainer').classList.add('hidden');
    loadDashboard();
    document.getElementById('filterYear').addEventListener('change', () => {
        currentPage = 1;
        fetchRecords();
    });
    document.getElementById('filterMonth').addEventListener('change', () => {
        currentPage = 1;
        fetchRecords();
    });
});

function initializeBlocksGrid() {
    const grid = document.getElementById('newBlocksGrid');
    BLOCKS.forEach(block => {
        const div = document.createElement('div');
        div.className = 'block-input';
        div.innerHTML = `
            <label>Block ${block}</label>
            <input type="number" step="0.1" placeholder="0" data-block="${block}" />
        `;
        grid.appendChild(div);
    });
}

function switchTab(dataType) {
    currentDataType = dataType;
    currentPage = 1;
    editingKey = null;
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (dataType === 'dashboard') {
        document.getElementById('dashboardContainer').classList.remove('hidden');
        document.getElementById('dataManagementContainer').classList.add('hidden');
        loadDashboard();
    } else {
        document.getElementById('dashboardContainer').classList.add('hidden');
        document.getElementById('dataManagementContainer').classList.remove('hidden');
        
        if (dataType === 'emissions') {
            document.getElementById('formTitle').textContent = 'Add New Emissions Record';
            document.getElementById('blockLabel').textContent = 'Block Values (kWh)';
            document.getElementById('tableHeader').textContent = 'Block Emissions (kWh)';
        } else {
            document.getElementById('formTitle').textContent = 'Add New GFA Record';
            document.getElementById('blockLabel').textContent = 'Block Values (m²)';
            document.getElementById('tableHeader').textContent = 'Block GFA (m²)';
        }
        
        document.getElementById('addFormContainer').classList.add('hidden');
        fetchRecords();
    }
}

async function loadDashboard() {
    try {
        const emissionsResponse = await fetch(`${API_BASE}/records`);
        if (!emissionsResponse.ok) throw new Error('Failed to fetch emissions');
        const emissionsData = await emissionsResponse.json();
        
        const gfaResponse = await fetch(`${API_BASE}/gfa`);
        if (!gfaResponse.ok) throw new Error('Failed to fetch GFA');
        const gfaData = await gfaResponse.json();
        
        if (emissionsData.length === 0) {
            document.getElementById('kpiTotalEmissions').textContent = 'No Data';
            document.getElementById('kpiLatestGFA').textContent = 'No Data';
            document.getElementById('kpiIntensity').textContent = 'No Data';
            return;
        }
        
        const sortedEmissions = emissionsData.sort((a, b) => {
            const yearA = a.Year || a.year;
            const yearB = b.Year || b.year;
            const monthA = a.Month || a.month;
            const monthB = b.Month || b.month;
            
            if (yearA !== yearB) return yearB - yearA;
            return monthB - monthA;
        });
        
        const latestEmission = sortedEmissions[0];
        const latestEmissionYear = latestEmission.Year || latestEmission.year;
        const latestEmissionMonth = latestEmission.Month || latestEmission.month;
        
        let totalEmissions = 0;
        for (let i = 1; i <= 15; i++) {
            const value = parseFloat(latestEmission[i.toString()]) || 0;
            totalEmissions += value;
        }
        
        const sortedGFA = gfaData.sort((a, b) => {
            const yearA = a.Year || a.year;
            const yearB = b.Year || b.year;
            const monthA = a.Month || a.month;
            const monthB = b.Month || b.month;
            
            if (yearA !== yearB) return yearB - yearA;
            return monthB - monthA;
        });
        
        let latestGFAYear = null;
        let latestGFAMonth = null;
        let totalGFA = 0;
        
        if (sortedGFA.length > 0) {
            const latestGFA = sortedGFA[0];
            latestGFAYear = latestGFA.Year || latestGFA.year;
            latestGFAMonth = latestGFA.Month || latestGFA.month;
            
            for (let i = 1; i <= 15; i++) {
                const value = parseFloat(latestGFA[i.toString()]) || 0;
                totalGFA += value;
            }
        }
        
        let intensityGFA = 0;
        const matchingGFA = gfaData.find(gfa => {
            const gfaYear = gfa.Year || gfa.year;
            const gfaMonth = gfa.Month || gfa.month;
            return gfaYear === latestEmissionYear && gfaMonth === latestEmissionMonth;
        });
        
        if (matchingGFA) {
            for (let i = 1; i <= 15; i++) {
                const value = parseFloat(matchingGFA[i.toString()]) || 0;
                intensityGFA += value;
            }
        }
        
        const intensity = intensityGFA > 0 ? (totalEmissions / intensityGFA).toFixed(2) : 'N/A';
        
        document.getElementById('kpiTotalEmissions').textContent = totalEmissions.toLocaleString() + ' kWh';
        document.getElementById('kpiEmissionsDate').textContent = `${getMonthName(latestEmissionMonth)} ${latestEmissionYear}`;
        
        if (totalGFA > 0) {
            document.getElementById('kpiLatestGFA').textContent = totalGFA.toLocaleString() + ' m²';
            document.getElementById('kpiGFADate').textContent = `${getMonthName(latestGFAMonth)} ${latestGFAYear}`;
        } else {
            document.getElementById('kpiLatestGFA').textContent = 'No Data';
            document.getElementById('kpiGFADate').textContent = '—';
        }
        
        document.getElementById('kpiIntensity').textContent = intensity !== 'N/A' ? intensity + ' kWh/m²' : 'No GFA Data';
        
        createEmissionsChart(sortedEmissions);
        calculateDataIntegrity(emissionsData, gfaData);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('kpiTotalEmissions').textContent = 'Error';
        document.getElementById('kpiLatestGFA').textContent = 'Error';
        document.getElementById('kpiIntensity').textContent = 'Error';
    }
}

function createEmissionsChart(emissionsData) {
    const ctx = document.getElementById('emissionsChart');
    
    if (emissionsChart) {
        emissionsChart.destroy();
    }
    
    const sortedData = emissionsData.sort((a, b) => {
        const yearA = a.Year || a.year;
        const yearB = b.Year || b.year;
        const monthA = a.Month || a.month;
        const monthB = b.Month || b.month;
        
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
    });
    
    const labels = [];
    const data = [];
    
    sortedData.forEach(record => {
        const year = record.Year || record.year;
        const month = record.Month || record.month;
        
        let total = 0;
        for (let i = 1; i <= 15; i++) {
            const value = parseFloat(record[i.toString()]) || 0;
            total += value;
        }
        
        labels.push(`${getMonthName(month)} ${year}`);
        data.push(total);
    });
    
    emissionsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Emissions (kWh)',
                data: data,
                borderColor: 'rgb(102, 126, 234)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: 'rgb(102, 126, 234)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            return 'Total: ' + context.parsed.y.toLocaleString() + ' kWh';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' kWh';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function calculateDataIntegrity(emissionsData, gfaData) {
    // Calculate completeness
    let totalFields = 0;
    let filledFields = 0;
    let missingByBlock = Array(15).fill(0);
    
    emissionsData.forEach(record => {
        for (let i = 1; i <= 15; i++) {
            totalFields++;
            const value = record[i.toString()];
            if (value !== null && value !== undefined && value !== '') {
                filledFields++;
            } else {
                missingByBlock[i - 1]++;
            }
        }
    });
    
    const completenessPercentage = totalFields > 0 ? ((filledFields / totalFields) * 100).toFixed(1) : 0;
    const missingCount = totalFields - filledFields;
    
    // Month Completeness - Check for missing months in sequence
    const yearMonthMap = new Map();
    emissionsData.forEach(record => {
        const year = record.Year || record.year;
        const month = record.Month || record.month;
        if (!yearMonthMap.has(year)) {
            yearMonthMap.set(year, new Set());
        }
        yearMonthMap.get(year).add(month);
    });
    
    let expectedMonths = 0;
    let actualMonths = 0;
    let missingMonthsList = [];
    
    yearMonthMap.forEach((months, year) => {
        const sortedMonths = Array.from(months).sort((a, b) => a - b);
        const minMonth = sortedMonths[0];
        const maxMonth = sortedMonths[sortedMonths.length - 1];
        
        // Count expected months from min to max
        for (let m = minMonth; m <= maxMonth; m++) {
            expectedMonths++;
            if (months.has(m)) {
                actualMonths++;
            } else {
                missingMonthsList.push(`${getMonthName(m)} ${year}`);
            }
        }
    });
    
    const monthCompletenessPercentage = expectedMonths > 0 ? 
        ((actualMonths / expectedMonths) * 100).toFixed(1) : 100;
    
    // Update UI
    document.getElementById('completenessPercentage').textContent = completenessPercentage + '%';
    document.getElementById('completenessDetail').textContent = `${filledFields} of ${totalFields} fields filled`;
    
    document.getElementById('totalRecordsCount').textContent = emissionsData.length;
    document.getElementById('recordsDetail').textContent = `${gfaData.length} GFA records`;
    
    document.getElementById('missingValuesCount').textContent = missingCount;
    document.getElementById('missingDetail').textContent = `${((missingCount / totalFields) * 100).toFixed(1)}% missing`;
    
    document.getElementById('monthCompleteness').textContent = monthCompletenessPercentage + '%';
    if (missingMonthsList.length > 0) {
        document.getElementById('monthDetail').textContent = 
            `${missingMonthsList.length} missing month${missingMonthsList.length > 1 ? 's' : ''}: ${missingMonthsList.slice(0, 3).join(', ')}${missingMonthsList.length > 3 ? '...' : ''}`;
    } else {
        document.getElementById('monthDetail').textContent = 'No gaps in monthly data';
    }
    
    // Create charts
    createMissingDataChart(missingByBlock);
    createCompletenessTrendChart(emissionsData);
}

function createMissingDataChart(missingByBlock) {
    const ctx = document.getElementById('missingDataChart');
    
    if (missingDataChart) {
        missingDataChart.destroy();
    }
    
    missingDataChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: BLOCKS.map(b => `Block ${b}`),
            datasets: [{
                label: 'Missing Values',
                data: missingByBlock,
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgb(239, 68, 68)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Missing: ' + context.parsed.y + ' records';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function createCompletenessTrendChart(emissionsData) {
    const ctx = document.getElementById('completenessTrendChart');
    
    if (completenessTrendChart) {
        completenessTrendChart.destroy();
    }
    
    const sortedData = emissionsData.sort((a, b) => {
        const yearA = a.Year || a.year;
        const yearB = b.Year || b.year;
        const monthA = a.Month || a.month;
        const monthB = b.Month || b.month;
        
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
    });
    
    const labels = [];
    const completenessData = [];
    
    sortedData.forEach(record => {
        const year = record.Year || record.year;
        const month = record.Month || record.month;
        
        let filled = 0;
        for (let i = 1; i <= 15; i++) {
            const value = record[i.toString()];
            if (value !== null && value !== undefined && value !== '') {
                filled++;
            }
        }
        
        const completeness = (filled / 15) * 100;
        labels.push(`${getMonthName(month)} ${year}`);
        completenessData.push(completeness);
    });
    
    completenessTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Data Completeness (%)',
                data: completenessData,
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(16, 185, 129)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Completeness: ' + context.parsed.y.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

function getMonthName(month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || '';
}

function toggleAddForm() {
    document.getElementById('addFormContainer').classList.toggle('hidden');
}

function clearFilters() {
    document.getElementById('filterYear').value = '';
    document.getElementById('filterMonth').value = '';
    currentPage = 1;
    fetchRecords();
}

async function fetchRecords() {
    try {
        const year = document.getElementById('filterYear').value;
        const month = document.getElementById('filterMonth').value;

        const endpoint = currentDataType === 'emissions' ? '/records' : '/gfa';
        let url = `${API_BASE}${endpoint}`;
        const params = new URLSearchParams();
        if (year) params.append('year', year);
        if (month) params.append('month', month);
        if (params.toString()) url += '?' + params.toString();

        console.log('Fetching from:', url);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch records');

        records = await response.json();
        console.log('Fetched records:', records);
        renderTable();
    } catch (error) {
        console.error('Error fetching records:', error);
        showStatus('Failed to fetch records', false);
        records = [];
        renderTable();
    }
}

function renderTable() {
    const tbody = document.getElementById('recordsTable');
    const totalRecords = records.length;

    document.getElementById('totalRecords').textContent = totalRecords;

    if (totalRecords === 0) {
        tbody.innerHTML = '<tr class="empty-state"><td colspan="18">No records found</td></tr>';
        document.getElementById('showingStart').textContent = '0';
        document.getElementById('showingEnd').textContent = '0';
        renderPaginationControls(0);
        return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const paginatedRecords = records.slice(startIndex, endIndex);

    document.getElementById('showingStart').textContent = startIndex + 1;
    document.getElementById('showingEnd').textContent = endIndex;

    tbody.innerHTML = paginatedRecords.map(record => {
        const year = record.Year || record.year;
        const month = record.Month || record.month; 
        const recordKey = `${year}-${month}`;
        const isEditing = editingKey === recordKey;

        const yearInput = isEditing
            ? `<input type="number" class="cell-input" value="${year}" data-field="year" />`
            : year;
        const monthInput = isEditing
            ? `<input type="number" class="cell-input" min="1" max="12" value="${month}" data-field="month" />`
            : month;

        let blockCells = '';
        BLOCKS.forEach(b => {
            const value = record[b] || '';
            blockCells += isEditing
                ? `<td><input type="number" step="0.1" class="cell-input" value="${value}" data-field="${b}" /></td>`
                : `<td>${value || '—'}</td>`;
        });

        const actionButtons = isEditing
            ? `<div class="action-buttons">
                    <button class="save-btn" onclick="saveEdit(${year},${month})">✓ Save</button>
                    <button class="cancel-btn" onclick="cancelEdit()">✕ Cancel</button>
            </div>`
            : `<div class="action-buttons">
                    <button class="edit-btn" onclick="startEdit(${year},${month})">Edit</button>
                    <button class="delete-btn" onclick="deleteRecord(${year},${month})">Delete</button>
            </div>`;

        return `<tr>
                    <td>${yearInput}</td>
                    <td>${monthInput}</td>
                    ${blockCells}
                    <td>${actionButtons}</td>
                </tr>`;
    }).join('');

    renderPaginationControls(totalRecords);
}

function startEdit(year, month) {
    editingKey = `${year}-${month}`;
    renderTable();
}

function cancelEdit() {
    editingKey = null;
    renderTable();
}

async function saveEdit(origYear, origMonth) {
    try {
        const row = document.querySelector(`button[onclick*="saveEdit(${origYear},${origMonth})"]`).closest('tr');
        const payload = {};

        row.querySelectorAll('input[data-field]').forEach(input => {
            const field = input.dataset.field;
            const value = (field === 'year' || field === 'month')
                ? parseInt(input.value)
                : (parseFloat(input.value) || null);
            payload[field] = value;
        });

        const endpoint = currentDataType === 'emissions' ? '/records' : '/gfa';
        const response = await fetch(`${API_BASE}${endpoint}/${origYear}/${origMonth}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to update');

        editingKey = null;
        fetchRecords();
        showStatus('Record updated successfully', true);
    } catch (error) {
        console.error('Error saving edit:', error);
        showStatus('Failed to save record', false);
    }
}

async function deleteRecord(year, month) {
    if (!confirm(`Are you sure you want to delete the record for ${month}/${year}?`)) return;

    try {
        console.log(`Attempting DELETE for ${year}/${month}`);

        const endpoint = currentDataType === 'emissions' ? '/records' : '/gfa'; 
        const response = await fetch(`${API_BASE}${endpoint}/${year}/${month}`, { 
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            console.error('Failed to parse DELETE response JSON', e);
            showStatus('❌ Failed to parse server response', false);
            return;
        }

        if (!response.ok) {
            console.error('Delete failed:', data);
            showStatus(`❌ Failed to delete record: ${data.error || response.statusText}`, false);
            return;
        }

        if (data.rows_deleted && data.rows_deleted > 0) {
            console.log(`Deleted ${data.rows_deleted} row(s)`);
            await fetchRecords();
            showStatus('✅ Record deleted successfully', true);
        } else {
            console.warn('No rows deleted:', data);
            showStatus('⚠️ Record not found or already deleted', false);
        }

    } catch (error) {
        console.error('Delete request failed:', error);
        showStatus('❌ Failed to delete record: ' + error.message, false);
    }
}

async function saveNewRecord() {
    try {
        const year = parseInt(document.getElementById('newYear').value);
        const month = parseInt(document.getElementById('newMonth').value);

        if (!year || !month) {
            showStatus('Year and month are required', false);
            return;
        }

        const payload = { year, month };
        BLOCKS.forEach(b => {
            const input = document.querySelector(`input[data-block="${b}"]`);
            payload[b] = parseFloat(input.value) || null;
        });

        const endpoint = currentDataType === 'emissions' ? '/records' : '/gfa';
        const response = await fetch(`${API_BASE}${endpoint}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to create record');

        document.getElementById('newYear').value = new Date().getFullYear();
        document.getElementById('newMonth').value = new Date().getMonth() + 1;
        document.querySelectorAll('#newBlocksGrid input').forEach(input => input.value = '');
        toggleAddForm();
        currentPage = 1;
        fetchRecords();
        showStatus('Record created successfully', true);
    } catch (error) {
        console.error('Error creating record:', error);
        showStatus('Failed to create record', false);
    }
}

async function handleImportUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        showStatus('Uploading CSV...', true);

        const fileContent = await file.text();
        
        // Determine filename based on current tab
        let filename = file.name;
        if (currentDataType === 'gfa' && !filename.toLowerCase().includes('gfa')) {
            // Prepend 'gfa_' to filename if on GFA tab and filename doesn't already contain 'gfa'
            const nameParts = filename.split('.');
            const extension = nameParts.pop();
            const baseName = nameParts.join('.');
            filename = `gfa_${baseName}.${extension}`;
        }

        const response = await fetch(`${API_BASE}/upload-csv?filename=${filename}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/csv' },
            body: fileContent
        });

        if (!response.ok) throw new Error('Upload failed');

        const result = await response.json();
        
        showStatus(`✓ File uploaded to ${result.folder || 'emissions'}/. Processing...`, true);
        
        // Wait for S3 trigger to process, then refresh
        setTimeout(() => {
            currentPage = 1;
            
            // If on dashboard, reload dashboard to show new data
            if (currentDataType === 'dashboard') {
                loadDashboard();
            } else {
                // If on data management tab, refresh the table
                fetchRecords();
            }
            
            showStatus('✅ Data imported successfully!', true);
        }, 3000);

        document.getElementById('csvFile').value = '';
    } catch (error) {
        console.error('Import error:', error);
        showStatus('Failed to import file: ' + error.message, false);
        document.getElementById('csvFile').value = '';
    }
}

function changePageSize() {
    pageSize = parseInt(document.getElementById('pageSize').value);
    currentPage = 1;
    renderTable();
}

function goToPage(page) {
    currentPage = page;
    renderTable();
}

function renderPaginationControls(totalRecords) {
    const totalPages = Math.ceil(totalRecords / pageSize);
    const controls = document.getElementById('paginationControls');

    if (totalPages <= 1) {
        controls.innerHTML = '';
        return;
    }

    let html = '';

    html += `<button class="btn-secondary" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Previous</button>`;

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        html += `<button class="page-number" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            html += `<span style="padding: 8px; color: #94a3b8;">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span style="padding: 8px; color: #94a3b8;">...</span>`;
        }
        html += `<button class="page-number" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="btn-secondary" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;

    controls.innerHTML = html;
}

function showStatus(message, isSuccess = true) {
    const el = document.getElementById('statusMessage');
    el.textContent = message;
    el.className = `status-message ${isSuccess ? 'status-success' : 'status-error'}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}
