// Connect to WebSocket server
const socket = io();

// DOM Elements
const blocksList = document.getElementById('blocksList');
const pendingTxList = document.getElementById('pendingTxList');
const minersList = document.getElementById('minersList');
const totalBlocks = document.getElementById('totalBlocks');
const pendingTxCount = document.getElementById('pendingTxCount');
const activeMiners = document.getElementById('activeMiners');
const totalClients = document.getElementById('totalClients');
const createClientBtn = document.getElementById('createClientBtn');
const mineBlockBtn = document.getElementById('mineBlockBtn');
const sendTransactionBtn = document.getElementById('sendTransactionBtn');
const fromAddressSelect = document.getElementById('fromAddress');
const toAddressSelect = document.getElementById('toAddress');
const amountInput = document.getElementById('amount');

// State
let clients = [];
let miners = [];

// Helper Functions
function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp) {
    return new Date(parseInt(timestamp)).toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
        timeZone: 'UTC'
    });
}

function showToast(message, type = 'success') {
    const toastContainer = document.querySelector('.toast-container') || (() => {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    })();

    const toast = document.createElement('div');
    toast.className = `toast show bg-${type} text-white`;
    toast.innerHTML = `
        <div class="toast-body">
            ${message}
        </div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function updateStats(data) {
    totalBlocks.textContent = data.blocks.length;
    pendingTxCount.textContent = data.pendingTransactions.length;
    activeMiners.textContent = data.miners.length;
    totalClients.textContent = data.clients.length;
}

function updateBlocksList(blocks) {
    blocksList.innerHTML = blocks.map(block => {
        let minerName = getMinerName(block.miner);
        return `
        <tr>
            <td>${block.blockNumber}</td>
            <td>${formatTimestamp(block.timestamp)}</td>
            <td>${block.transactions}</td>
            <td class="address-truncate">${block.hash}</td>
            <td>${minerName}</td>
        </tr>
        `;
    }).join('');
}

function getMinerName(address) {
    if (!address) return '';
    if (address === 'network_fund') return 'network_fund';
    const miner = miners.find(m => m.address === address);
    return miner && miner.name ? miner.name : address;
}

function updatePendingTransactions(transactions) {
    pendingTxList.innerHTML = transactions.map(tx => `
        <tr>
            <td class="address-truncate">${tx.from}</td>
            <td class="address-truncate">${tx.to}</td>
            <td>${tx.amount}</td>
            <td>${formatTimestamp(tx.timestamp)}</td>
        </tr>
    `).join('');
}

function updateMinersList(miners) {
    const minersList = document.getElementById('minersList');
    minersList.innerHTML = '';

    if (!Array.isArray(miners) || miners.length === 0) {
        console.warn('No miners to display:', miners);
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" class="text-center text-muted">No miners found.</td>`;
        minersList.appendChild(row);
        return;
    }

    miners.forEach((miner, idx) => {
        const name = miner.name && miner.name.trim() !== '' ? miner.name : `Miner ${idx + 1}`;
        const address = miner.address || '-';
        const power = miner.power !== undefined ? miner.power : '-';
        const port = miner.port !== undefined ? miner.port : '-';
        const rewards = miner.rewards !== undefined ? miner.rewards : (miner.miningRewards !== undefined ? miner.miningRewards : '-');
        const status = miner.active !== undefined ? (miner.active ? 'Active' : 'Inactive') : '-';
        const statusClass = miner.active ? 'bg-success' : 'bg-danger';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${name}</td>
            <td class="address-truncate">${address.length > 12 ? address.slice(0, 12) + '...' : address}</td>
            <td><span class="badge bg-info"><i class="fas fa-bolt me-1"></i>${power}</span></td>
            <td>${port}</td>
            <td>${rewards} coins</td>
            <td><span class="badge ${statusClass}">${status}</span></td>
        `;
        minersList.appendChild(row);
    });
}

function updateClientSelects() {
    const options = clients.map((client, idx) => {
        let name = client.name && client.name.trim() !== '' ? client.name : `Client ${idx + 1}`;
        return `<option value="${client.address}">${name} (${formatAddress(client.address)}) - ${client.balance} coins</option>`;
    }).join('');

    fromAddressSelect.innerHTML = options;
    toAddressSelect.innerHTML = options;
}

function updateClientsList(clients) {
    const clientsList = document.getElementById('clientsList');
    clientsList.innerHTML = clients.map((client, idx) => {
        let name = client.name && client.name.trim() !== '' ? client.name : `Client ${idx + 1}`;
        return `
        <tr>
            <td>${name}</td>
            <td class="address-truncate">${formatAddress(client.address)}</td>
            <td>${client.balance}</td>
        </tr>
        `;
    }).join('');
}

// Event Listeners
createClientBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/create-client', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast('New client created successfully');
            const modal = bootstrap.Modal.getInstance(document.getElementById('createClientModal'));
            modal.hide();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (error) {
        showToast('Failed to create client', 'danger');
    }
});

mineBlockBtn.addEventListener('click', async () => {
    try {
        mineBlockBtn.disabled = true;
        mineBlockBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mining...';
        
        const response = await fetch('/api/mine', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Block mined successfully');
        } else {
            showToast(data.message, 'danger');
        }
    } catch (error) {
        showToast('Failed to mine block', 'danger');
    } finally {
        mineBlockBtn.disabled = false;
        mineBlockBtn.innerHTML = '<i class="fas fa-hammer me-1"></i>Mine Block';
    }
});

sendTransactionBtn.addEventListener('click', async () => {
    const fromAddress = fromAddressSelect.value;
    const toAddress = toAddressSelect.value;
    const amount = parseInt(amountInput.value);

    if (!fromAddress || !toAddress || !amount) {
        showToast('Please fill all fields', 'warning');
        return;
    }

    if (fromAddress === toAddress) {
        showToast('Cannot send to the same address', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/send-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromAddress, toAddress, amount })
        });

        const data = await response.json();
        
        if (data.success) {
            showToast('Transaction sent successfully');
            const modal = bootstrap.Modal.getInstance(document.getElementById('sendTransactionModal'));
            modal.hide();
            document.getElementById('transactionForm').reset();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (error) {
        showToast('Failed to send transaction', 'danger');
    }
});

// WebSocket Event Handlers
socket.on('blockchain-update', (data) => {
    updateStats(data);
    updateBlocksList(data.blocks);
    updatePendingTransactions(data.pendingTransactions);
    updateMinersList(data.miners);
    clients = data.clients;
    miners = data.miners;
    updateClientSelects();
    updateClientsList(clients);
});

socket.on('transaction-added', (data) => {
    updatePendingTransactions(data.transactions);
    pendingTxCount.textContent = data.count;
});

socket.on('client-created', (data) => {
    clients.push(data);
    updateClientSelects();
    totalClients.textContent = clients.length;
    updateClientsList(clients);
    showToast('New client created successfully');
});

// Initial data load
socket.on('connect', () => {
    console.log('Connected to server');
});

// زرار تحديث الجداول

document.getElementById('refreshBlocksBtn').addEventListener('click', async () => {
    const res = await fetch('/api/blocks');
    const blocks = await res.json();
    updateBlocksList(blocks);
});

document.getElementById('refreshPendingBtn').addEventListener('click', async () => {
    const res = await fetch('/api/pending-transactions');
    const data = await res.json();
    updatePendingTransactions(data.transactions);
    pendingTxCount.textContent = data.count;
});

document.getElementById('refreshMinersBtn').addEventListener('click', async () => {
    const res = await fetch('/api/miners');
    const minersData = await res.json();
    updateMinersList(minersData);
});

document.getElementById('refreshClientsBtn').addEventListener('click', async () => {
    const res = await fetch('/api/clients');
    const clientsData = await res.json();
    clients = clientsData;
    updateClientSelects();
    updateClientsList(clients);
    totalClients.textContent = clients.length;
});

// Miner creation form handling
document.getElementById('createMinerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const port = document.getElementById('port').value;
    const power = document.getElementById('power').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';
        
        const response = await fetch('/api/miners', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ port, power })
        });

        const data = await response.json();
        
        if (response.ok) {
            showToast('✅ Miner created successfully');
            // Reset form
            e.target.reset();
            // Switch to view miners tab
            document.getElementById('view-miners-tab').click();
            // Refresh miners list
            document.getElementById('refreshMinersBtn').click();
        } else {
            showToast(`⛔ ${data.message}`, 'danger');
        }
    } catch (error) {
        showToast('⛔ Failed to create miner', 'danger');
        console.error('Error:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus me-2"></i>Create Miner';
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    // Load and display blocks
    try {
        const blocksRes = await fetch('/api/blocks');
        const blocks = await blocksRes.json();
        updateBlocksList(blocks);
    } catch (e) { console.error('Failed to load blocks', e); }

    // Load and display pending transactions
    try {
        const pendingRes = await fetch('/api/pending-transactions');
        const pendingData = await pendingRes.json();
        updatePendingTransactions(pendingData.transactions);
        pendingTxCount.textContent = pendingData.count;
    } catch (e) { console.error('Failed to load pending transactions', e); }

    // Load and display miners
    try {
        const minersRes = await fetch('/api/miners');
        const minersData = await minersRes.json();
        updateMinersList(minersData);
        activeMiners.textContent = minersData.length;
    } catch (e) { console.error('Failed to load miners', e); }

    // Load and display clients
    try {
        const clientsRes = await fetch('/api/clients');
        const clientsData = await clientsRes.json();
        clients = clientsData;
        updateClientSelects();
        updateClientsList(clients);
        totalClients.textContent = clients.length;
    } catch (e) { console.error('Failed to load clients', e); }

    // Load and display stats (blocks, miners, clients, pending)
    // If you want to update stats from the above, you can call updateStats with a composed object
}); 