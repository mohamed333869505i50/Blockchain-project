const fs = require('fs');
const path = require('path');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const { Wallet } = require('./wallet');
const { Blockchain } = require('./blockchain');
const { Network } = require('./network');

class MinerManager {
    constructor(blockchain) {
        this.blockchain = blockchain;
        this.miners = [];
        this.loadMiners();
    }

    saveMiners() {
        const minersData = this.miners.map(miner => ({
            address: miner.address,
            privateKey: miner.wallet.privateKey,
            publicKey: miner.wallet.publicKey,
            port: miner.port,
            power: miner.power,
            name: miner.name || ''
        }));

        fs.writeFileSync(
            path.join(__dirname, 'miners-data.json'),
            JSON.stringify(minersData, null, 2)
        );
    }

    loadMiners() {
        try {
            const data = fs.readFileSync(path.join(__dirname, 'miners-data.json'), 'utf8');
            const minersData = JSON.parse(data);

            // أسماء لأول 3 معدنين
            const names = ["youssef", "hema", "sohail"];
            let unnamedIndex = 0;

            minersData.forEach((minerData, idx) => {
                const wallet = new Wallet();
                wallet.keyPair = ec.keyFromPrivate(minerData.privateKey);
                wallet.publicKey = minerData.publicKey;
                wallet.privateKey = minerData.privateKey;

                let name = minerData.name;
                if (!name || name === "") {
                    if (unnamedIndex < names.length) {
                        name = names[unnamedIndex];
                    } else {
                        name = `Miner ${unnamedIndex + 1}`;
                    }
                    unnamedIndex++;
                }

                const miner = {
                    address: minerData.address,
                    wallet,
                    port: minerData.port,
                    power: minerData.power,
                    name,
                    network: new Network(minerData.port, [], this.blockchain)
                };

                this.blockchain.registerMiner(miner.address, miner.power);
                this.miners.push(miner);
            });
        } catch (err) {
            console.log('No existing miner data found, starting fresh');
        }
    }

    createMiner(port, power = 1) {
        const wallet = new Wallet();
        // أسماء لأول 3 معدنين
        const names = ["youssef", "hema", "sohail"];
        let name = `Miner ${this.miners.length + 1}`;
        if (this.miners.length < names.length) {
            name = names[this.miners.length];
        }
        const miner = {
            address: wallet.getAddress(),
            wallet,
            port,
            power,
            name,
            network: new Network(port, [], this.blockchain)
        };
        
        this.blockchain.registerMiner(miner.address, power);
        this.miners.push(miner);
        this.saveMiners();
        
        console.log(`⛏️ Miner created: ${name} on port ${port} with power ${power}`);
        return miner;
    }

    startAllMiners() {
        this.miners.forEach(miner => {
            miner.network.startServer();
            console.log(`🔄 Miner ${miner.address.slice(0, 12)}... started on port ${miner.port}`);
        });
    }
}

module.exports = { MinerManager };